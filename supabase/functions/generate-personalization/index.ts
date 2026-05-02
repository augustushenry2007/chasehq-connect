import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  checkDailyQuota,
  getClientIp,
  rateLimitedResponse,
  quotaExceededResponse,
} from "../_shared/rate_limit.ts";
import { sanitizeUserText, readJsonWithCap, MAX_SHORT_FIELD_CHARS } from "../_shared/prompt_filter.ts";
import { logError, logWarn, truncate } from "../_shared/log.ts";

interface PersonalizationBody {
  feelings?: string[];
  worries?: string[];
  goals?: string[];
  custom?: { feelings?: string; worries?: string; goals?: string };
  firstName?: string;
}

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // Onboarding runs before signup, so this is intentionally guest-callable.
    // Cost protection therefore comes from layered IP-keyed limits + payload
    // caps + prompt filter + max_tokens. The DB-backed rate limit replaces
    // an old in-memory limiter that was bypassable by hitting cold-start
    // instances across regions.
    const ip = getClientIp(req);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rl = await checkRateLimit(admin, `ip:${ip}`, "generate-personalization", 10);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const dq = await checkDailyQuota(admin, `ip:${ip}`, "generate-personalization", 30);
    if (!dq.allowed) return quotaExceededResponse(cors);

    const parsed = await readJsonWithCap<PersonalizationBody>(req);
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
    const { feelings = [], worries = [], goals = [], custom = {}, firstName = "" } = parsed.body ?? {};

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const join = (xs: Array<string | undefined>) =>
      xs.filter((s): s is string => typeof s === "string" && s.length > 0).join(", ");

    // Sanitize every user-supplied string for prompt-injection markers and
    // truncate to a sane size. Track total injection attempts for telemetry.
    let injectionAttempts = 0;
    const cleanShort = (s: unknown) => {
      const r = sanitizeUserText(s, MAX_SHORT_FIELD_CHARS);
      injectionAttempts += r.attempts;
      return r.sanitized;
    };

    const cleanFeelings = [...feelings, custom.feelings].map(cleanShort);
    const cleanWorries = [...worries, custom.worries].map(cleanShort);
    const cleanGoals = [...goals, custom.goals].map(cleanShort);
    const cleanFirst = cleanShort(firstName);

    const userContext = `
User's first name: ${cleanFirst || "unknown"}
How they feel about money conversations: ${join(cleanFeelings) || "not specified"}
What happens when they think about sending a follow-up: ${join(cleanWorries) || "not specified"}
What would make this easier for them: ${join(cleanGoals) || "not specified"}
`.trim();

    const systemPrompt = `You are a copywriter for ChaseHQ, an app that handles invoice follow-ups for freelancers. Generate a brief, punchy personalization screen. Be specific and human, never generic. Keep every line tight — no fluff, no filler, no marketing-speak. Speak in second person.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContext },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "render_personalization",
              description: "Return a personalized headline, pain points, and benefits.",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Short, punchy headline (max 6 words)." },
                  subhead: { type: "string", description: "One short sentence reframing their experience (max 14 words)." },
                  painPoints: {
                    type: "array",
                    description: "Exactly 2 pain points. Title max 4 words. Detail max 12 words.",
                    minItems: 2,
                    maxItems: 2,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Max 4 words." },
                        detail: { type: "string", description: "Max 12 words." },
                      },
                      required: ["title", "detail"],
                      additionalProperties: false,
                    },
                  },
                  benefits: {
                    type: "array",
                    description: "Exactly 2 benefits. Title max 4 words. Detail max 12 words.",
                    minItems: 2,
                    maxItems: 2,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Max 4 words." },
                        detail: { type: "string", description: "Max 12 words." },
                      },
                      required: ["title", "detail"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["headline", "subhead", "painPoints", "benefits"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "render_personalization" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
      const t = await response.text();
      logError("AI gateway error:", response.status, truncate(t));
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      logWarn("No tool call returned");
      return json({ error: "AI returned empty response" }, 500);
    }
    const args = JSON.parse(toolCall.function.arguments);

    // Cost telemetry: log token usage so we can answer "what did this cost?"
    // and trigger anomaly alerts. Best-effort — failure to log doesn't fail
    // the user-facing request.
    const usage = data.usage ?? {};
    admin.from("gemini_usage").insert({
      function_name: "generate-personalization",
      subject: `ip:${ip}`,
      model: "gemini-2.5-flash",
      input_tokens: usage.prompt_tokens ?? null,
      output_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      prompt_injection_attempts: injectionAttempts,
    }).then(({ error }) => {
      if (error) logWarn("gemini_usage insert failed:", error.message);
    });

    return json(args);
  } catch (e) {
    logError("generate-personalization error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

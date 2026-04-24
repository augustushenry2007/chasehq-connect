// Simple in-memory per-IP rate limiter (per warm instance).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateMap = new Map<string, number[]>();
function checkRate(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  rateMap.set(ip, arr);
  return true;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Onboarding runs before signup, so guests must be allowed.
    // Lightweight per-IP soft rate limit to deter credit-drain abuse.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRate(ip)) {
      return json({ error: "Too many requests, please slow down." }, 429);
    }

    const { feelings = [], worries = [], goals = [], custom = {}, firstName = "" } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const userContext = `
User's first name: ${firstName || "unknown"}
How they feel about money conversations: ${[...feelings, custom.feelings].filter(Boolean).join(", ") || "not specified"}
What happens when they think about sending a follow-up: ${[...worries, custom.worries].filter(Boolean).join(", ") || "not specified"}
What would make this easier for them: ${[...goals, custom.goals].filter(Boolean).join(", ") || "not specified"}
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
                  headline: {
                    type: "string",
                    description: "Short, punchy headline (max 6 words).",
                  },
                  subhead: {
                    type: "string",
                    description: "One short sentence reframing their experience (max 14 words).",
                  },
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
      if (response.status === 429) {
        return json({ error: "Rate limited, try again shortly." }, 429);
      }
      if (response.status === 402) {
        return json({ error: "AI credits exhausted." }, 402);
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");
    const args = JSON.parse(toolCall.function.arguments);

    return json(args);
  } catch (e) {
    console.error("generate-personalization error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

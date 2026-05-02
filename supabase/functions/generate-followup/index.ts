import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  checkDailyQuota,
  getClientIp,
  rateLimitedResponse,
  quotaExceededResponse,
} from "../_shared/rate_limit.ts";
import {
  sanitizeUserText,
  readJsonWithCap,
  MAX_FIELD_CHARS,
  MAX_SHORT_FIELD_CHARS,
} from "../_shared/prompt_filter.ts";
import { logError, logWarn, truncate } from "../_shared/log.ts";

function buildToneInstruction(tone: string, priorFollowupCount: number): string {
  const TONE_INSTRUCTIONS: Record<string, string> = {
    Polite:
      "Warm, respectful, slightly apologetic. Assume the client simply forgot. Use soft language ('just a gentle nudge', 'whenever you have a moment'). 4-6 sentences.",
    Friendly:
      "Casual, upbeat, conversational. Use contractions and a personal tone. Sound like a human checking in, not a collections department. 4-6 sentences.",
    Firm:
      "Direct, matter-of-fact, professional. No apologies, no padding. State the facts and the expected action clearly. 4-6 sentences.",
    Urgent:
      "Serious and time-sensitive. Emphasize that this is now overdue and needs immediate attention. Mention that further action may follow. 4-6 sentences.",
  };
  if (tone === "Final Notice") {
    if (priorFollowupCount === 0) {
      return "Formal, escalation-level final communication, but this is the FIRST message the sender is sending about this invoice — the user just logged a back-dated invoice that's already significantly overdue. Acknowledge that this may be the first the recipient is hearing on this account (e.g. 'I realize this may be the first message you've received from me about this invoice'). Do NOT reference 'multiple prior reminders' or 'as I mentioned previously' — there are none. State clearly that if payment is not received within 7 days, next steps may include referral to a third-party collections agency or further recovery action. Do NOT make legal threats. Stay professional and offer a clear path to resolve. The subject line MUST start with 'FINAL NOTICE — '. 6-9 sentences.";
    }
    return "Formal, escalation-level final communication. Reference that multiple prior reminders have been sent. State clearly that if payment is not received within 7 days, next steps may include referral to a third-party collections agency or further recovery action. Do NOT make legal threats or claims a lawyer would make. Do NOT cite specific laws. Stay professional and offer one last chance to resolve amicably. The subject line MUST start with 'FINAL NOTICE — '. 6-9 sentences.";
  }
  return TONE_INSTRUCTIONS[tone] || `Use a ${tone.toLowerCase()} tone.`;
}

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // verify_jwt is false (the guest-draft flow calls it before signup), so we
  // layer protections: per-IP per-minute, per-IP per-day, per-user where a
  // JWT is present, plus payload caps and prompt-injection sanitization.
  const ip = getClientIp(req);
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // If the caller is authenticated, prefer per-user limits over per-IP. This
  // prevents legitimate users behind shared NAT (offices, coffee shops) from
  // exhausting an IP-keyed quota that another user is also drawing down.
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user?.id) userId = user.id;
  }
  const subject = userId ? userId : `ip:${ip}`;
  const dailyCap = userId ? 200 : 50;

  const rl = await checkRateLimit(supabaseAdmin, subject, "generate-followup", 20);
  if (!rl.allowed) return rateLimitedResponse(cors);

  const dq = await checkDailyQuota(supabaseAdmin, subject, "generate-followup", dailyCap);
  if (!dq.allowed) return quotaExceededResponse(cors);

  try {
    const parsed = await readJsonWithCap<{
      invoice?: Record<string, unknown>;
      tone?: string;
      previousMessage?: string;
      senderDisplayName?: string;
      priorFollowupCount?: number;
    }>(req);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: parsed.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { invoice, tone, previousMessage, senderDisplayName, priorFollowupCount } = parsed.body ?? {};

    if (!invoice || !tone) {
      return new Response(JSON.stringify({ error: "Missing invoice or tone" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Sanitize every user-controlled string against prompt injection and
    // truncate to a sane length. The invoice description is the largest
    // attack surface — clients can put arbitrary text in there.
    let injectionAttempts = 0;
    const cleanShort = (s: unknown) => {
      const r = sanitizeUserText(s, MAX_SHORT_FIELD_CHARS);
      injectionAttempts += r.attempts;
      return r.sanitized;
    };
    const cleanLong = (s: unknown) => {
      const r = sanitizeUserText(s, MAX_FIELD_CHARS);
      injectionAttempts += r.attempts;
      return r.sanitized;
    };

    const safeInvoice = {
      invoice_number: cleanShort((invoice as Record<string, unknown>).invoice_number ?? (invoice as Record<string, unknown>).id),
      client: cleanShort((invoice as Record<string, unknown>).client),
      amount: cleanShort((invoice as Record<string, unknown>).amount),
      due_date: cleanShort((invoice as Record<string, unknown>).due_date ?? (invoice as Record<string, unknown>).dueDate),
      days_past_due: cleanShort(
        (invoice as Record<string, unknown>).days_past_due ?? (invoice as Record<string, unknown>).daysPastDue ?? 0,
      ),
      description: cleanLong((invoice as Record<string, unknown>).description),
      sent_from: cleanShort((invoice as Record<string, unknown>).sent_from ?? (invoice as Record<string, unknown>).sentFrom),
    };
    const safePrev = previousMessage ? cleanLong(previousMessage) : "";

    // Default 1 (legacy clients): preserves the old "reference multiple prior
    // reminders" behavior for Final Notice. New clients pass an actual count.
    const toneInstruction = buildToneInstruction(tone, typeof priorFollowupCount === "number" ? priorFollowupCount : 1);

    // Prefer the explicit display name; fall back to deriving from email
    const rawSender = safeInvoice.sent_from;
    const derivedName = rawSender
      ? rawSender.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "the sender";
    const senderName = senderDisplayName && cleanShort(senderDisplayName).trim()
      ? cleanShort(senderDisplayName).trim().replace(/\b\w/g, (c: string) => c.toUpperCase())
      : derivedName;

    const systemPrompt = `You are a professional follow-up email writer for freelancers and agencies chasing unpaid invoices.
Write a follow-up email for the given invoice using the specified tone.
Return ONLY a JSON object with "subject" and "message" fields.
The message should be the full email body text (no HTML, no markdown).
Use blank lines (\\n\\n) to separate every paragraph — never run paragraphs together on a single line.
The sign-off MUST be on its own line at the end, separated from the body by a blank line. Format it exactly as:
<closing phrase>,\\n${senderName}
For example: "Best regards,\\nAugustus Henry" or "Many thanks,\\nAugustus Henry". Never put the name on the same line as the body text.
Each generation should produce a meaningfully different variation in wording, structure, and opening — never reuse the same sentences.

TONE GUIDELINES for "${tone}":
${toneInstruction}`;

    const variationSeed = crypto.randomUUID();
    const previousBlock = safePrev
      ? `\n\nThe previous draft was:\n"""\n${safePrev}\n"""\nWrite a meaningfully different variation — different opening, different sentence structure, different word choices. Do not repeat phrases.`
      : "";

    const userPrompt = `Write a ${cleanShort(tone)} follow-up email for this invoice:
- Invoice: ${safeInvoice.invoice_number}
- Client: ${safeInvoice.client}
- Amount: $${safeInvoice.amount}
- Due date: ${safeInvoice.due_date}
- Days overdue: ${safeInvoice.days_past_due}
- Sender: ${senderName}
- Description: ${safeInvoice.description}

Variation seed: ${variationSeed}${previousBlock}`;

    const buildBody = (model: string) => JSON.stringify({
      model,
      temperature: 0.95,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_followup",
            description: "Return a follow-up email with subject and message",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Email subject line" },
                message: { type: "string", description: "Full email body text" },
              },
              required: ["subject", "message"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_followup" } },
    });

    // Gemini 2.5 Flash hits capacity often; retry once, then fall back to 2.0 Flash.
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: "gemini-2.5-flash", delayMs: 0 },
      { model: "gemini-2.5-flash", delayMs: 800 },
      { model: "gemini-2.0-flash", delayMs: 400 },
    ];

    let response: Response | null = null;
    let lastErrorText = "";
    let lastStatus = 0;
    for (const attempt of attempts) {
      if (attempt.delayMs) await new Promise((r) => setTimeout(r, attempt.delayMs));
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
        },
        body: buildBody(attempt.model),
      });
      if (response.ok) break;
      lastStatus = response.status;
      lastErrorText = await response.text();
      logError(`AI gateway error (model=${attempt.model}):`, response.status, truncate(lastErrorText));
      // Only retry on transient upstream failures.
      if (response.status !== 503 && response.status !== 502 && response.status !== 504 && response.status !== 500) break;
    }

    if (!response || !response.ok) {
      if (lastStatus === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (lastStatus === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      // Don't echo upstream error bodies to clients — they can include
      // internal hints, request IDs, or partial credentials. Log on the
      // server only.
      const friendly = lastStatus === 503
        ? "AI is busy right now. Please try again in a moment."
        : "AI service error. Please try again.";
      return new Response(JSON.stringify({ error: friendly }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let result: { subject: string; message: string };
    try {
      if (toolCall?.function?.arguments) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        const content: string | undefined = data.choices?.[0]?.message?.content;
        if (!content) {
          logError("No tool_calls or content:", truncate(JSON.stringify(data)));
          return new Response(JSON.stringify({ error: "AI returned empty response" }), {
            status: 500,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        result = JSON.parse(jsonMatch ? jsonMatch[1] : content);
      }
    } catch (parseErr) {
      logError("Parse error:", parseErr, "data:", truncate(JSON.stringify(data)));
      return new Response(
        JSON.stringify({ error: "AI response parse failed" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!result?.subject || !result?.message) {
      return new Response(
        JSON.stringify({ error: "AI response missing subject/message" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Cost telemetry — best-effort, doesn't fail the request on insert error.
    const usage = data.usage ?? {};
    supabaseAdmin.from("gemini_usage").insert({
      function_name: "generate-followup",
      subject,
      model: "gemini-2.5-flash",
      input_tokens: usage.prompt_tokens ?? null,
      output_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      prompt_injection_attempts: injectionAttempts,
    }).then(({ error }) => {
      if (error) logWarn("gemini_usage insert failed:", error.message);
    });

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("generate-followup error:", e);
    return new Response(JSON.stringify({ error: "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

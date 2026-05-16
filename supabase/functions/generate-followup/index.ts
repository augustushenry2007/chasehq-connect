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

type UserProfile = {
  workType?: "designer" | "developer" | "writer" | "consultant" | "agency" | "other";
  invoiceSize?: "<500" | "500-2k" | "2k-10k" | "10k+";
  clientLoad?: "1-3" | "4-10" | "10+";
  mirrorBlockers?: Array<"dread" | "overthinking" | "avoidance" | "letting_slide">;
  worstOverdueBucket?: "<14" | "14-30" | "30-60" | "60+";
};

function buildPersonalizationClause(profile: UserProfile | undefined, tone: string): string {
  if (!profile) return "";
  const parts: string[] = [];

  // Work type → vocabulary register. The AI is instructed to draw on these
  // terms naturally where it would otherwise default to generic phrasing.
  switch (profile.workType) {
    case "designer":
      parts.push("The sender is a designer. Where natural, use industry vocabulary like 'project', 'deliverable', or 'design work' rather than generic terms. Lean toward warm, collaborative phrasing.");
      break;
    case "developer":
      parts.push("The sender is a developer. Where natural, use vocabulary like 'milestone', 'sprint', 'build', or 'release'. Lean toward precise, professional phrasing.");
      break;
    case "writer":
      parts.push("The sender is a writer. Where natural, use vocabulary like 'piece', 'draft', 'editorial work', or 'writing'. Lean toward considered, articulate phrasing.");
      break;
    case "consultant":
      parts.push("The sender is a consultant. Where natural, use vocabulary like 'engagement', 'advisory', or 'scope'. Lean toward measured, professional phrasing — avoid casual contractions like 'gonna'.");
      break;
    case "agency":
      parts.push("The sender represents an agency or studio. Use 'we' / 'our' instead of 'I' / 'my'. Use vocabulary like 'engagement', 'scope', or 'deliverable'. Lean toward formal, institutional phrasing — even on Friendly tone, prefer 'Best regards' over 'Cheers'.");
      break;
  }

  // Invoice size → stakes calibration. Within the same tone tier, larger
  // invoices warrant longer cushioning and more formal phrasing.
  switch (profile.invoiceSize) {
    case "<500":
      if (tone === "Friendly") parts.push("This is a small-invoice business. Friendly follow-ups can be tighter and more direct — skip extensive cushioning.");
      break;
    case "10k+":
      parts.push("This is a high-value invoice business. Even on Friendly tone, include a sentence of relational cushioning before the ask. Avoid aggressive language even on Final Notice — keep it formal and procedural rather than confrontational.");
      break;
  }

  // Client load → relational framing.
  switch (profile.clientLoad) {
    case "1-3":
      parts.push("The sender works with a small number of clients (1–3). Frame this invoice as individually important — do NOT use phrasing implying scale or volume like 'across our active engagements'.");
      break;
    case "10+":
      parts.push("The sender manages many clients (10+). Phrasing implying organized book-keeping at scale is natural (e.g. 'reconciling outstanding engagements', 'keeping our records current').");
      break;
  }

  // Mirror blockers → opener mood. These shape the opening sentence's mood
  // to align with how the user wants to come across.
  if (profile.mirrorBlockers?.length) {
    if (profile.mirrorBlockers.includes("overthinking")) {
      parts.push("The sender tends to overthink follow-up wording. Use openers that sound confident and warm — avoid hedging language like 'I just', 'sorry to bother', 'no rush whatsoever'. Be direct without being abrupt.");
    }
    if (profile.mirrorBlockers.includes("letting_slide")) {
      parts.push("The sender tends to let invoices slide past their due date. Use openers that sound organized rather than apologetic for being late — e.g. 'reconciling my books today and noticed…' rather than 'sorry this is late'.");
    }
    if (profile.mirrorBlockers.includes("dread") || profile.mirrorBlockers.includes("avoidance")) {
      parts.push("The sender finds follow-ups uncomfortable. Use a soft-direct opener: warm and human, but not apologetic. Get to the point inside the first two sentences.");
    }
  }

  if (parts.length === 0) return "";
  return `\n\nPERSONALIZATION (calibrated to this sender's onboarding answers):\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

function buildToneInstruction(tone: string, priorFollowupCount: number): string {
  const TONE_INSTRUCTIONS: Record<string, string> = {
    Polite:
      "Warm, respectful, slightly apologetic. Assume the client simply forgot. Use soft language ('just a gentle nudge', 'whenever you have a moment'). 4-6 sentences. If the invoice is not yet due, frame this as a proactive, friendly heads-up — do NOT use 'overdue' language.",
    Friendly:
      "Casual, upbeat, conversational. Use contractions and a personal tone. Sound like a human checking in, not a collections department. 4-6 sentences. If the invoice is not yet due, frame this as a proactive, friendly heads-up — do NOT use 'overdue' language.",
    Firm:
      "Direct, matter-of-fact, professional. No apologies, no padding. State the facts and the expected action clearly. 4-6 sentences. Match language strictly to the payment timing: for a future-due invoice, write a firm pre-due reminder (e.g. 'please ensure payment is arranged by the due date') — do NOT claim the invoice is overdue. For an overdue invoice, state the overdue facts plainly.",
    Urgent:
      "Serious and time-sensitive. 4-6 sentences. Adapt urgency language to the payment timing: if the invoice is not yet due, urgency is about the approaching deadline and need for immediate confirmation — do NOT claim the invoice is overdue. If the invoice IS overdue, emphasize the breach and that further action may follow.",
  };
  if (tone === "Final Notice") {
    const timingNote = "Regardless of when the due date falls, always match language to the actual payment timing — never claim the invoice is overdue if it is not.";
    if (priorFollowupCount === 0) {
      return `Formal, escalation-level final communication, but this is the FIRST message the sender is sending about this invoice. Acknowledge that this may be the first the recipient is hearing about this (e.g. 'I realize this may be the first message you've received from me about this invoice'). Do NOT reference 'multiple prior reminders' or 'as I mentioned previously' — there are none. State clearly that if payment is not received, next steps may include referral to a third-party collections agency or further recovery action. Do NOT make legal threats. Stay professional and offer a clear path to resolve. The subject line MUST start with 'FINAL NOTICE — '. 6-9 sentences. ${timingNote}`;
    }
    return `Formal, escalation-level final communication. Reference that prior reminders have been sent. State clearly that if payment is not received, next steps may include referral to a third-party collections agency or further recovery action. Do NOT make legal threats or claims a lawyer would make. Do NOT cite specific laws. Stay professional and offer one last chance to resolve amicably. The subject line MUST start with 'FINAL NOTICE — '. 6-9 sentences. ${timingNote}`;
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
  const dailyCap = userId ? 30 : 50;

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
      userProfile?: UserProfile;
      promptVersion?: number;
    }>(req);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: parsed.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { invoice, tone, previousMessage, senderDisplayName, userProfile, promptVersion } = parsed.body ?? {};
    // Only Final Notice phrasing depends on the prior count (see buildToneInstruction);
    // skip the DB round-trip on every other tone to keep TTFB low.
    let priorFollowupCount: number = 1;
    if (tone === "Final Notice") {
      const invoiceDbId = typeof invoice === "object" && invoice !== null ? (invoice as Record<string, unknown>).dbId ?? (invoice as Record<string, unknown>).id : null;
      if (typeof invoiceDbId === "string" && invoiceDbId && invoiceDbId !== "guest") {
        const { count } = await supabaseAdmin.from("followups").select("id", { count: "exact", head: true }).eq("invoice_id", invoiceDbId);
        priorFollowupCount = count ?? 0;
      }
    }

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

    // Format the amount as a currency string before sanitizing — sanitizeUserText
    // returns "" for any non-string input, so passing the raw number would silently
    // strip it and the AI would write "for the amount of $." in the body.
    const rawAmount = (invoice as Record<string, unknown>).amount;
    const amountNum = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
    const amountStr = Number.isFinite(amountNum)
      ? amountNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";

    const safeInvoice = {
      invoice_number: cleanShort((invoice as Record<string, unknown>).invoice_number ?? (invoice as Record<string, unknown>).id),
      client: cleanShort((invoice as Record<string, unknown>).client),
      amount: amountStr,
      // ISO field is the source of truth for timing math; display field is what the AI sees in the prompt.
      // The frontend Invoice has dueDateISO (yyyy-MM-dd) AND dueDate (formatDate output, human-readable).
      due_date_iso: cleanShort((invoice as Record<string, unknown>).dueDateISO ?? (invoice as Record<string, unknown>).due_date),
      due_date_display: cleanShort((invoice as Record<string, unknown>).dueDate ?? (invoice as Record<string, unknown>).due_date),
      description: cleanLong((invoice as Record<string, unknown>).description),
      sent_from: cleanShort((invoice as Record<string, unknown>).sent_from ?? (invoice as Record<string, unknown>).sentFrom),
    };
    const dueDisplay = safeInvoice.due_date_display || safeInvoice.due_date_iso;
    const safePrev = previousMessage ? cleanLong(previousMessage) : "";

    // Compute timing context server-side from current date vs due date.
    // This is the authoritative source — the client-side daysPastDue field is stale
    // (set to 0 on invoice creation and never live-updated on the frontend).
    const todayISO = new Date().toISOString().split("T")[0];
    // Strict ISO gate: a human-formatted string like "May 14, 2026" produces NaN
    // through new Date(...+"T00:00:00Z"), which would silently leave timingContext
    // as "Due date unknown" — defeating the whole timing-aware prompt.
    const isoForMath = String(safeInvoice.due_date_iso || "").slice(0, 10);
    let timingContext = "Due date unknown";
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoForMath)) {
      const dueMs = new Date(isoForMath + "T00:00:00Z").getTime();
      const todayMs = new Date(todayISO + "T00:00:00Z").getTime();
      const daysDiff = Math.round((dueMs - todayMs) / 86_400_000);
      const pl = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
      if (daysDiff > 1) timingContext = `Due in ${pl(daysDiff)} (due ${isoForMath}, today ${todayISO}) — NOT yet overdue`;
      else if (daysDiff === 1) timingContext = `Due tomorrow (due ${isoForMath}, today ${todayISO}) — NOT yet overdue`;
      else if (daysDiff === 0) timingContext = `Due today (${todayISO}) — payment is due now`;
      else if (daysDiff === -1) timingContext = `1 day overdue (was due ${isoForMath}, today ${todayISO})`;
      else timingContext = `${pl(-daysDiff)} overdue (was due ${isoForMath}, today ${todayISO})`;
    }

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

OUTPUT FORMAT — output ONLY the following, with NO preamble, NO explanation, NO JSON, NO markdown, NO code fences, NO quotes wrapping the content:
<the subject line on a single line>
---END_SUBJECT---
<the full email body, multi-line>

The line "---END_SUBJECT---" must appear on its own line exactly as shown, separating the subject line above from the email body below. Do not include this marker anywhere else.
The body MUST begin with a greeting line addressed to the recipient (e.g. "Hi <client first name>,", "Hello <client> team,", or for unnamed recipients "Hi there,"). Put the greeting on its own line, then a blank line, then the rest of the body.
The email body should be plain text only (no HTML, no markdown).
Use blank lines (\\n\\n) to separate every paragraph — never run paragraphs together on a single line.
The sign-off MUST be on its own line at the end, separated from the body by a blank line. Format it exactly as:
<closing phrase>,\\n${senderName}
For example: "Best regards,\\nAugustus Henry" or "Many thanks,\\nAugustus Henry". Never put the name on the same line as the body text.
Each generation should produce a meaningfully different variation in wording, structure, and opening — never reuse the same sentences.

CRITICAL TIMING RULE: The "Payment timing" field is the factual ground truth about the invoice's current state. You MUST use it to determine the correct language:
- If it says "NOT yet overdue" → NEVER use "overdue", "past due", "missed deadline", "was due", or any language implying the due date has already passed. Use future-looking language: "is due on", "coming due", "due date approaching".
- If it says "due today" → payment is due now; use present-tense language.
- If it says "X days overdue" → state the overdue fact clearly and appropriately.

MANDATORY FIELDS — every email body MUST explicitly mention all of:
1. The invoice amount (e.g. "$1,500.00") — never write "$." or omit the number
2. The invoice number (e.g. "INV-001")
3. The due date (e.g. "May 14, 2026")
4. The client's name OR project description so it's clear which work this refers to

If any field above is genuinely missing from the input, omit only that field gracefully — never write a placeholder like "$" or "[amount]" with no value.

DELIVERABILITY — to keep the email out of Promotions/Spam:
- Do NOT use ALL CAPS except for legitimate proper nouns (company names, acronyms like USA, EU). "FINAL NOTICE" in the subject is allowed only on Final Notice tone.
- Use at most one exclamation mark in the entire body.
- Avoid spam-trigger phrases: "Urgent!", "Act now", "Click here", "Risk-free", "100% guaranteed", "Limited time", "$$$", "Free money".
- Do not repeat punctuation (no "!!!", "???", "..!").
- Do not write all-caps words longer than 3 characters (e.g. "REALLY", "ASAP") — use normal case.
- Keep the tone professional and calm regardless of the assigned tone — even Urgent or Final Notice should sound like a human, not a collection scam.

TONE GUIDELINES for "${tone}":
${toneInstruction}${buildPersonalizationClause(userProfile, tone)}`;

    const variationSeed = crypto.randomUUID();
    const previousBlock = safePrev
      ? `\n\nThe previous draft was:\n"""\n${safePrev}\n"""\nWrite a meaningfully different variation — different opening, different sentence structure, different word choices. Do not repeat phrases.`
      : "";

    const userPrompt = `Write a ${cleanShort(tone)} follow-up email for this invoice:
- Invoice: ${safeInvoice.invoice_number}
- Client: ${safeInvoice.client}
- Amount: ${safeInvoice.amount ? `$${safeInvoice.amount}` : "(amount not provided)"}
- Due date: ${dueDisplay || "(due date not provided)"}
- Payment timing: ${timingContext}
- Sender: ${senderName}
- Description: ${safeInvoice.description}

Variation seed: ${variationSeed}${previousBlock}`;

    const buildBody = (model: string) => JSON.stringify({
      model,
      temperature: 0.95,
      // 2048 is generous headroom for a 4–6 sentence email. flash-lite has no
      // thinking budget to share with output, so this is purely for visible text.
      max_tokens: 2048,
      stream: true,
      // Final SSE chunk carries token usage; we forward it on the `done` event
      // so the client knows we're complete and we can write gemini_usage.
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // gemini-2.5-flash-lite is the active primary: no dynamic thinking, so
    // visible tokens stream from the first byte (essential for cascading UX).
    // gemini-2.5-flash was switched away from because its OpenAI-compat layer
    // does not honor reasoning_effort, leading to 600–900 token thinking gaps
    // that suppressed visible streaming. gemini-2.0-flash was retired by Google.
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: "gemini-2.5-flash-lite", delayMs: 0 },
      { model: "gemini-2.5-flash-lite", delayMs: 300 },
      { model: "gemini-2.5-flash-lite", delayMs: 200 },
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
      if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) {
        logError(`Gemini auth/request error ${lastStatus}:`, truncate(lastErrorText));
        return new Response(JSON.stringify({ error: "AI configuration error. Please contact support." }), {
          status: 500,
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

    // Pipe Gemini's OpenAI-compat SSE stream into our own SSE stream so the
    // client can render subject + message progressively. Format is delimited
    // plain text from the model: <subject>\n---END_SUBJECT---\n<body>.
    const upstream = response.body;
    if (!upstream) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SEPARATOR = "\n---END_SUBJECT---\n";
    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const writeEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const reader = upstream.getReader();
        let buf = "";
        let accumulated = "";
        let subjectEmitted = false;
        let parsedSubject = "";
        let lastMessageEnd = 0;
        let usage: Record<string, unknown> | null = null;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // OpenAI SSE: events are separated by "\n\n", each line either
            // "data: <json>" or "data: [DONE]".
            let nl: number;
            while ((nl = buf.indexOf("\n\n")) !== -1) {
              const block = buf.slice(0, nl);
              buf = buf.slice(nl + 2);
              for (const line of block.split("\n")) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                let chunk: { choices?: Array<{ delta?: { content?: string } }>; usage?: Record<string, unknown> };
                try {
                  chunk = JSON.parse(payload);
                } catch {
                  continue;
                }
                if (chunk.usage) usage = chunk.usage;
                const delta = chunk.choices?.[0]?.delta?.content;
                if (typeof delta !== "string" || delta.length === 0) continue;
                accumulated += delta;

                if (!subjectEmitted) {
                  const sepIdx = accumulated.indexOf(SEPARATOR);
                  if (sepIdx !== -1) {
                    parsedSubject = accumulated.slice(0, sepIdx).trim();
                    writeEvent("subject", { subject: parsedSubject });
                    subjectEmitted = true;
                    lastMessageEnd = sepIdx + SEPARATOR.length;
                    const initialBody = accumulated.slice(lastMessageEnd);
                    if (initialBody.length > 0) {
                      writeEvent("message_delta", { delta: initialBody });
                      lastMessageEnd = accumulated.length;
                    }
                  }
                  // else: still streaming the subject line; hold delta until we see the separator.
                } else {
                  const newBody = accumulated.slice(lastMessageEnd);
                  if (newBody.length > 0) {
                    writeEvent("message_delta", { delta: newBody });
                    lastMessageEnd = accumulated.length;
                  }
                }
              }
            }
          }

          // Stream finished. Best-effort recovery if the model didn't emit the
          // separator: take first line as subject, remainder as body.
          if (!subjectEmitted) {
            const firstNl = accumulated.indexOf("\n");
            if (firstNl > 0) {
              parsedSubject = accumulated.slice(0, firstNl).trim();
              const body = accumulated.slice(firstNl + 1).trim();
              writeEvent("subject", { subject: parsedSubject });
              if (body.length > 0) writeEvent("message_delta", { delta: body });
              logWarn("generate-followup: model omitted SEPARATOR; used first-line fallback");
            } else {
              writeEvent("error", { error: "AI response malformed" });
              controller.close();
              return;
            }
          }

          writeEvent("done", { usage });
          controller.close();
        } catch (e) {
          logError("generate-followup stream pipe error:", e);
          try { writeEvent("error", { error: "stream interrupted" }); } catch { /* controller may be closed */ }
          try { controller.close(); } catch { /* already closed */ }
          return;
        }

        // Cost telemetry — best-effort, fire-and-forget after the stream closes.
        // `subject` here is the rate-limit identifier (user id or ip:<addr>),
        // matching the prior implementation's column write.
        if (usage) {
          supabaseAdmin.from("gemini_usage").insert({
            function_name: "generate-followup",
            subject,
            model: "gemini-2.5-flash-lite",
            input_tokens: usage.prompt_tokens ?? null,
            output_tokens: usage.completion_tokens ?? null,
            total_tokens: usage.total_tokens ?? null,
            prompt_injection_attempts: injectionAttempts,
          }).then(({ error }: { error: { message: string } | null }) => {
            if (error) logWarn("gemini_usage insert failed:", error.message);
          });
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        // Hint to any intermediary proxies (and WKWebView's URLSession layer)
        // not to coalesce chunks before delivering them to the client.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    logError("generate-followup error:", e);
    return new Response(JSON.stringify({ error: "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

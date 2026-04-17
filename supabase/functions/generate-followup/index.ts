import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  Polite:
    "Warm, respectful, slightly apologetic. Assume the client simply forgot. Use soft language ('just a gentle nudge', 'whenever you have a moment'). 4-6 sentences.",
  Friendly:
    "Casual, upbeat, conversational. Use contractions and a personal tone. Sound like a human checking in, not a collections department. 4-6 sentences.",
  Firm:
    "Direct, matter-of-fact, professional. No apologies, no padding. State the facts and the expected action clearly. 4-6 sentences.",
  Urgent:
    "Serious and time-sensitive. Emphasize that this is now overdue and needs immediate attention. Mention that further action may follow. 4-6 sentences.",
  "Final Notice":
    "Formal, escalation-level final communication. Reference that multiple prior reminders have been sent. State clearly that if payment is not received within 7 days, next steps may include referral to a third-party collections agency or further recovery action. Do NOT make legal threats or claims a lawyer would make. Do NOT cite specific laws. Stay professional and offer one last chance to resolve amicably. The subject line MUST start with 'FINAL NOTICE — '. 6-9 sentences.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoice, tone, previousMessage } = await req.json();

    if (!invoice || !tone) {
      return new Response(JSON.stringify({ error: "Missing invoice or tone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const toneInstruction = TONE_INSTRUCTIONS[tone] || `Use a ${tone.toLowerCase()} tone.`;

    const systemPrompt = `You are a professional follow-up email writer for freelancers and agencies chasing unpaid invoices.
Write a follow-up email for the given invoice using the specified tone.
Return ONLY a JSON object with "subject" and "message" fields.
The message should be the full email body text (no HTML, no markdown).
Sign off as the sender name from the invoice.
Each generation should produce a meaningfully different variation in wording, structure, and opening — never reuse the same sentences.

TONE GUIDELINES for "${tone}":
${toneInstruction}`;

    const variationSeed = crypto.randomUUID();
    const previousBlock = previousMessage
      ? `\n\nThe previous draft was:\n"""\n${previousMessage}\n"""\nWrite a meaningfully different variation — different opening, different sentence structure, different word choices. Do not repeat phrases.`
      : "";

    const userPrompt = `Write a ${tone} follow-up email for this invoice:
- Invoice: ${invoice.invoice_number || invoice.id}
- Client: ${invoice.client}
- Amount: $${invoice.amount}
- Due date: ${invoice.due_date || invoice.dueDate}
- Days overdue: ${invoice.days_past_due || invoice.daysPastDue || 0}
- Sender: ${invoice.sent_from || invoice.sentFrom || "Jamie Doe"}
- Description: ${invoice.description}

Variation seed: ${variationSeed}${previousBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.95,
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-followup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

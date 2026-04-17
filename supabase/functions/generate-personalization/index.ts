const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { feelings = [], worries = [], goals = [], custom = {}, firstName = "" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContext = `
User's first name: ${firstName || "unknown"}
How they feel about money conversations: ${[...feelings, custom.feelings].filter(Boolean).join(", ") || "not specified"}
What happens when they think about sending a follow-up: ${[...worries, custom.worries].filter(Boolean).join(", ") || "not specified"}
What would make this easier for them: ${[...goals, custom.goals].filter(Boolean).join(", ") || "not specified"}
`.trim();

    const systemPrompt = `You are a copywriter for ChaseHQ, an app that handles invoice follow-ups for freelancers. Generate a deeply personal, empathetic, outcome-driven personalization screen based on the user's onboarding answers. Speak directly to them in second person. Be specific, not generic. Reflect their exact words back where possible.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
                    description: "Short, personal headline (max 12 words). Use their name if known. Example: 'Anna, here's why chasing feels heavy.'",
                  },
                  subhead: {
                    type: "string",
                    description: "One sentence reframing their experience with empathy (max 25 words).",
                  },
                  painPoints: {
                    type: "array",
                    description: "2-3 pain points reflecting their inputs. Each is a short title + one-line detail.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        detail: { type: "string" },
                      },
                      required: ["title", "detail"],
                      additionalProperties: false,
                    },
                  },
                  benefits: {
                    type: "array",
                    description: "2-3 outcome-driven benefits tailored to their goals. Each is a short title + one-line detail.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        detail: { type: "string" },
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
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-personalization error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

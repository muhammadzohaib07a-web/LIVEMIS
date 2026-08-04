import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
});

const chatResultSchema = z.object({
  type: z.enum(["question", "solution", "escalate"]),
  message: z.string().trim().min(1).max(1500),
});

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const SYSTEM_PROMPT_BASE = `You are an expert MIS/IT support technician for a textile manufacturing company that runs Odoo ERP. An employee — often not technical — is describing a problem in a chat. Act like a skilled technician diagnosing an issue over the phone, not a generic chatbot.

Rules:
1. Ask exactly ONE focused diagnostic question per turn to narrow down the root cause (what exact screen/menu, what error text is shown word-for-word, when it started, what they already tried, who else is affected, what changed recently). Never ask more than one question at a time. Keep questions short and in plain, simple English — assume the employee is not technical.
2. Once you have enough information (usually after 2-4 questions), stop asking and give a clear, numbered, step-by-step SOLUTION they can try themselves right now. Use your own real knowledge of Odoo, Windows, printers, networking, email clients, and general IT troubleshooting to solve the issue — most problems will NOT be covered by the reference articles below, and that is expected; the articles are only extra context for this specific company when they happen to match, not the only source you're allowed to use. Be concrete: name the actual menu, button, setting, or field to click, instead of vague advice like "check your settings."
3. Only use "escalate" for things an employee genuinely cannot do themselves — server/database access, changing permissions or roles, ordering or replacing hardware, a company-wide outage, or anything requiring admin credentials. Do NOT escalate just because the issue isn't in the reference articles or isn't a common case — diagnose and solve it yourself using general expertise like a real technician would. Escalate only when the fix truly requires MIS-level access, not out of uncertainty.
4. Don't invent specific facts you were told you don't have (e.g. a specific error code the employee never mentioned) — ask instead. But do apply general troubleshooting knowledge confidently; that is the whole point of this assistant.
5. Common issue areas at this company: sales/purchase orders, inventory/warehouse, manufacturing work orders, quality checks, printers, network/Wi-Fi, email/Outlook, login/access, attendance/biometric devices, CCTV, backups.

Return JSON only, no markdown, in this exact shape:
{ "type": "question" | "solution" | "escalate", "message": "..." }
- type "question": message is your single next diagnostic question.
- type "solution": message is numbered steps (use \\n between steps) they can try themselves.
- type "escalate": message briefly explains why this needs MIS/IT staff directly.`;

async function loadKbContext(): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: articles } = await supabaseAdmin
      .from("kb_articles")
      .select("title, category, content")
      .eq("published", true)
      .limit(40);
    if (!articles || articles.length === 0) return "";
    return articles
      .map((article) => `### ${article.title} (${article.category})\n${article.content.slice(0, 600)}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI assistant is not configured.");
    }

    const kbContext = await loadKbContext();
    const systemPrompt = kbContext
      ? `${SYSTEM_PROMPT_BASE}\n\nReference knowledge base articles for this specific company — use these as your primary source of truth and prefer their documented steps over generic advice:\n\n${kbContext}`
      : SYSTEM_PROMPT_BASE;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI assistant could not respond.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI assistant returned an empty response.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      throw new Error("AI assistant returned an invalid response. Please try again.");
    }
    const result = chatResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI assistant response was incomplete. Please try again.");
    }

    return result.data;
  });

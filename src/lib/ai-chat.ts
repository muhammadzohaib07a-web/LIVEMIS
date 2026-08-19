import { createServerFn } from "@tanstack/react-start";
import { extractJson } from "@/lib/ai-json";
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
1. Judge each turn on its own: if the employee's message (even their very first one) already gives you enough detail to diagnose the issue confidently — specific document/order number, exact error text, exact screen, what's happening — skip straight to a "solution" reply. Do not ask a question just to follow a routine. Only ask a question when you genuinely lack a detail you need to be confident. When you do ask, it's exactly ONE focused diagnostic question, short and in plain, simple English — assume the employee is not technical.
2. When giving a SOLUTION, make it a clear, numbered, step-by-step answer they can try themselves right now. Use your own real knowledge of Odoo, Windows, printers, networking, email clients, and general IT troubleshooting to solve the issue — most problems will NOT be covered by the reference below, and that is expected; it is only extra context for this specific company when it happens to match, not the only source you're allowed to use. Be concrete: name the actual menu, button, setting, or field to click, instead of vague advice like "check your settings."
3. Only use "escalate" for things an employee genuinely cannot do themselves — server/database access, changing permissions or roles, ordering or replacing hardware, a company-wide outage, or anything requiring admin credentials. Do NOT escalate just because the issue isn't in the reference or isn't a common case — diagnose and solve it yourself using general expertise like a real technician would. Escalate only when the fix truly requires MIS-level access, not out of uncertainty.
4. Don't invent specific facts you were told you don't have (e.g. a specific error code the employee never mentioned) — ask instead. But do apply general troubleshooting knowledge confidently; that is the whole point of this assistant.
5. Common issue areas at this company: sales/purchase orders, inventory/warehouse, manufacturing work orders, quality checks, printers, network/Wi-Fi, email/Outlook, login/access, attendance/biometric devices, CCTV, backups.
6. Language: detect what the employee is writing in and reply the same way. If they write in Urdu script or Roman Urdu (Urdu words spelled out in English letters, e.g. "printer nahi chal raha"), reply in Roman Urdu too. If they write in English, reply in English. Never switch them to a language they did not use.

Return JSON only, no markdown, in this exact shape:
{ "type": "question" | "solution" | "escalate", "message": "..." }
- type "question": message is your single next diagnostic question.
- type "solution": message is numbered steps (use \\n between steps) they can try themselves.
- type "escalate": message briefly explains why this needs MIS/IT staff directly.`;

// Structural facts about this company's real Odoo 17 Community instance,
// gathered directly from their Odoo. Kept deliberately short — this gets
// resent on every single turn of every conversation (the API has no memory
// between calls), so its token cost is paid over and over, not once.
const ODOO_REFERENCE = `COMPANY ODOO NOTES — Leen Textile runs Odoo 17 Community, heavily customized for textile manufacturing. Manufacturing Orders go draft->confirmed->progress->to_close->done (buttons: Confirm, Start, Plan, Check availability, Produce). Sales Orders: draft->sent->sale. Purchase Orders: draft->sent->to approve->purchase (Approve/Unlock need Purchase Manager role). Finished goods pass through a custom multi-stage production flow: Cutting -> Embroidery -> Stitching -> Packing, each stage its own Manufacturing Order (prefixes CUTP-MO-, EMBP-MO-, STIPR-MO-, PACKP-MO-) linked by stock transfers, and each stage MO needs its incoming transfer Done and its Quality Check passed before it can start — "Complete the incoming stage transfer(s) first" and "Create and pass the Quality Check before starting" are real messages employees see when those aren't ready yet.`;

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "on", "for", "and", "or",
  "not", "it", "this", "that", "with", "can", "how", "what", "why", "hai", "ho", "ka", "ki",
  "ke", "mein", "se", "ko", "aur", "kya", "nahi", "raha", "rahi", "rha", "kar", "krna", "kro",
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

// Rather than dumping every KB article into every request (expensive and
// dilutes relevance), score published articles by how many keywords from
// the conversation appear in their title/category and only include the
// handful that actually look relevant. Falls back to nothing if no article
// matches — the model's own Odoo/IT knowledge covers the rest anyway.
async function loadRelevantKbContext(conversationText: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: articles } = await supabaseAdmin
      .from("kb_articles")
      .select("title, category, content")
      .eq("published", true)
      .limit(60);
    if (!articles || articles.length === 0) return "";

    const keywords = extractKeywords(conversationText);
    if (keywords.size === 0) return "";

    const scored = articles
      .map((article) => {
        const haystack = extractKeywords(`${article.title} ${article.category}`);
        let score = 0;
        for (const word of haystack) if (keywords.has(word)) score += 1;
        return { article, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) return "";
    return scored
      .map(
        ({ article }) => `### ${article.title} (${article.category})\n${article.content.slice(0, 400)}`,
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

// Tried in order; if the first model errors, is rate-limited, or returns a
// response that doesn't parse as valid JSON, the next one is tried instead
// of surfacing an error to the employee.
// Groq retired both Llama models this used to call, which is why every AI
// feature stopped at once. These two are their replacements on the account.
const FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const RECENT_MESSAGE_COUNT = 12;

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 450,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  });

  const payload = (await response.json()) as GroqResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `AI model ${model} could not respond.`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`AI model ${model} returned an empty response.`);

  const parsed: unknown = extractJson(content);
  return chatResultSchema.parse(parsed);
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI assistant is not configured.");
    }

    const recentMessages = data.messages.slice(-RECENT_MESSAGE_COUNT);
    const conversationText = recentMessages.map((m) => m.content).join(" ");

    const kbContext = await loadRelevantKbContext(conversationText);
    const systemPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${ODOO_REFERENCE}` +
      (kbContext
        ? `\n\nRelevant knowledge base articles for this specific issue — prefer their documented steps over generic advice:\n\n${kbContext}`
        : "");

    let lastError: unknown;
    for (const model of FALLBACK_MODELS) {
      try {
        return await callGroq(apiKey, model, systemPrompt, recentMessages);
      } catch (error) {
        console.error(`[ai-chat] model ${model} failed, trying next fallback:`, error);
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("AI assistant could not respond. Please try again.");
  });

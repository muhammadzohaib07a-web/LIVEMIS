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
// gathered directly from their Odoo. Kept in two sizes: the full version for
// the primary model, and a short version for the smaller fallback model
// (which has a much tighter per-request token budget) so a fallback call
// never fails just from prompt size alone.
const ODOO_REFERENCE_FULL = `COMPANY ODOO REFERENCE — LEEN TEXTILE (Odoo 17 Community, self-hosted). Use these exact names, states, buttons, and error strings whenever relevant instead of generic/standard Odoo assumptions — this instance is heavily customized, especially manufacturing.

1. Manufacturing Order (MO) states in order: draft (Draft) -> confirmed (Confirmed) -> progress (In Progress) -> to_close (To Close) -> done (Done), or cancel any time. Buttons: Confirm -> Start -> Plan -> Check availability -> Produce/Produce All -> Cancel. Unbuild appears after done.
2. Sales Order states: draft (Quotation) -> sent (Quotation Sent) -> sale (Sales Order) -> cancel, plus a separate locked boolean. Buttons: Send -> Send PRO-FORMA Invoice -> Confirm -> Lock/Unlock -> Set to Quotation -> Cancel.
3. Purchase Order states: draft (RFQ) -> sent (RFQ Sent) -> to approve (To Approve, Purchase Manager only above threshold) -> purchase (Purchase Order) -> cancel, plus locked boolean. Buttons: Send RFQ -> Confirm Order -> Approve Order -> Send PO -> Lock/Unlock (Unlock needs Purchase Manager) -> Cancel.
4. Warehouse: single real warehouse "LEEN TEXTILE (PRIVATE) LIMITED" [WH]. Custom multi-stage production workflow (production_stage_tracking module): finished goods move Cutting -> Embroidery -> Stitching -> Packing, each its own linked MO, connected by stock transfers using custom operation types (Cutting IN/OUT, Embroidery OUT, Stitching OUT, Packing IN). An MO cannot start until its incoming stage transfer(s) are Done and its Quality Check has passed. MO numbering carries a stage prefix: CUTP-MO-XXXXX, EMBP-MO-XXXXX, STIPR-MO-XXXXX, PACKP-MO-XXXXX (generic MOs: WH/MO/00001).
5. Quality Checks (custom model leen.quality.check): draft -> in_progress -> passed/failed. Must pass before a stage MO can start production; a failed check blocks it.
6. Custom fields (all prefixed x_) exist on product.template (fabric/collection/design attributes), mrp.production (stage tracking: x_production_stage, x_stage_parent_mo_id, x_workflow_state, etc), and stock.picking (x_is_stage_transfer, x_stage_from/to, etc) — these are specific to the stage workflow above, not standard Odoo fields.
7. Real validation error strings from the stage workflow: "Complete the incoming stage transfer(s) first: [transfers]. After they are Done, click Check Availability." / "Material is not ready for [MO]. Complete the required transfers and then click Check Availability." / "Create and pass the Quality Check before starting [MO]." / "Production is blocked because Quality Check(s) failed: [checks]." Native Odoo also shows a "Consumption Warning" wizard if actual material use differs from the BOM when marking an MO done.
8. Document numbering: MOs WH/MO/00001 or stage-prefixed as above; Sales Orders S00001; Purchase Orders P00001; Internal transfers INT/00001; Unbuild UB/00001; Scrap SP/00001.
9. Access groups in use: mrp.group_mrp_user/manager (Manufacturing User/Admin), account.group_account_user/readonly (Accounting), purchase.group_purchase_manager (needed for PO Approve/Unlock), base.group_system/user (standard Odoo admin/internal user).`;

const ODOO_REFERENCE_COMPACT = `COMPANY ODOO NOTES — Leen Textile runs Odoo 17 Community, heavily customized for textile manufacturing. Key facts: Manufacturing Orders go draft->confirmed->progress->to_close->done (buttons: Confirm, Start, Plan, Check availability, Produce). Sales Orders: draft->sent->sale. Purchase Orders: draft->sent->to approve->purchase (Approve/Unlock need Purchase Manager role). Finished goods pass through a custom multi-stage production flow: Cutting -> Embroidery -> Stitching -> Packing, each stage its own Manufacturing Order (prefixes CUTP-MO-, EMBP-MO-, STIPR-MO-, PACKP-MO-) linked by stock transfers, and each stage MO needs its incoming transfer Done and its Quality Check passed before it can start — "Complete the incoming stage transfer(s) first" and "Create and pass the Quality Check before starting" are real messages employees see when those aren't ready yet.`;

async function loadKbContext(maxArticles: number, excerptLength: number): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: articles } = await supabaseAdmin
      .from("kb_articles")
      .select("title, category, content")
      .eq("published", true)
      .limit(maxArticles);
    if (!articles || articles.length === 0) return "";
    return articles
      .map(
        (article) =>
          `### ${article.title} (${article.category})\n${article.content.slice(0, excerptLength)}`,
      )
      .join("\n\n");
  } catch {
    return "";
  }
}

// Tried in order; if the first model errors, is rate-limited, or returns a
// response that doesn't parse as valid JSON, the next one is tried instead
// of surfacing an error to the employee. The smaller fallback model gets a
// much lighter prompt (short Odoo notes, no KB dump) since it has a tight
// per-request token budget that the full context would blow past on its own.
const FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const RECENT_MESSAGE_COUNT = 14;

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

  const parsed: unknown = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
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

    const fullKbContext = await loadKbContext(10, 250);
    const fullPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${ODOO_REFERENCE_FULL}` +
      (fullKbContext
        ? `\n\nReference knowledge base articles for this specific company — prefer their documented steps over generic advice when relevant:\n\n${fullKbContext}`
        : "");
    const compactPrompt = `${SYSTEM_PROMPT_BASE}\n\n${ODOO_REFERENCE_COMPACT}`;

    let lastError: unknown;
    for (const [index, model] of FALLBACK_MODELS.entries()) {
      const systemPrompt = index === 0 ? fullPrompt : compactPrompt;
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

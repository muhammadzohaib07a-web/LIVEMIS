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
6. Language: detect what the employee is writing in and reply the same way. If they write in Urdu script or Roman Urdu (Urdu words spelled out in English letters, e.g. "printer nahi chal raha"), reply in Roman Urdu too. If they write in English, reply in English. Never switch them to a language they did not use.

Return JSON only, no markdown, in this exact shape:
{ "type": "question" | "solution" | "escalate", "message": "..." }
- type "question": message is your single next diagnostic question.
- type "solution": message is numbered steps (use \\n between steps) they can try themselves.
- type "escalate": message briefly explains why this needs MIS/IT staff directly.`;

// Structural facts about this company's real Odoo 17 Community instance —
// installed modules, workflow states/buttons, custom fields, and known
// error strings — gathered directly from their Odoo. Static (doesn't need
// a live DB query), so it's baked into the prompt rather than fetched.
const ODOO_REFERENCE = `COMPANY ODOO REFERENCE — LEEN TEXTILE (Odoo 17 Community, self-hosted). Use these exact names, states, buttons, and error strings whenever relevant instead of generic/standard Odoo assumptions — this instance is heavily customized, especially manufacturing.

1. INSTALLED MODULES (111 total)
Core: base, mail, contacts, calendar, mrp, sale, sale_management, purchase, stock, account, project
Manufacturing extras: mrp_account, mrp_costing_report (custom), mrp_subcontracting, mrp_subcontracting_account/purchase
Custom/business-specific: production_stage_tracking, fabric_consumption_report, fg_purchase_production_report, greige_inventory_report, leen_quality_check, textile_variant_report, store_transfer_sales_report, warehouse_sales_inventory_report, custom_invoice_report, custom_customer, gatepass_management, str_detail_report
Sales/Purchase extras: sale_stock, sale_mrp, sale_project, purchase_stock, purchase_mrp, sale_purchase_stock
Project: project, project_mrp, project_account, project_stock, project_purchase
Accounting: account_edi_ubl_cii, invoice_qweb_report, invoice_summary_report
Other: barcodes, digest, spreadsheet_dashboard, api_doc, l10n_us

2. MANUFACTURING ORDER (MO) WORKFLOW
States in order: draft (Draft) -> confirmed (Confirmed) -> progress (In Progress) -> to_close (To Close) -> done (Done), or cancel (Cancelled) at any point.
Buttons: Confirm (visible when draft) -> Start (confirmed) -> Plan (confirmed/progress/to_close) -> Check availability (any state except draft/done/cancel) -> Produce / Produce All (marks done) -> Cancel. Unbuild button appears after done.

3. SALES ORDER (SO) WORKFLOW
States: draft (Quotation) -> sent (Quotation Sent) -> sale (Sales Order) -> cancel (Cancelled), plus a separate "locked" boolean controlled by Lock/Unlock.
Buttons: Send -> Send PRO-FORMA Invoice -> Confirm (Quotation to Sales Order) -> Lock/Unlock -> Set to Quotation (reverts to draft) -> Cancel.

4. PURCHASE ORDER (PO) WORKFLOW
States: draft (RFQ) -> sent (RFQ Sent) -> to approve (To Approve) -> purchase (Purchase Order) -> cancel (Cancelled), plus a separate "locked" boolean.
Buttons: Send RFQ -> Confirm Order -> Approve Order (only visible to Purchase Manager group, needed above the approval threshold) -> Send PO (once purchase) -> Lock/Unlock (Unlock needs Purchase Manager) -> Set to Draft (from cancel) -> Cancel -> Print.

5. WAREHOUSES & OPERATION TYPES
Warehouses: LEEN TEXTILE (PRIVATE) LIMITED [WH] (the real one; others are demo/unused: My Company-domain module, My Company-emporium, Dolmen mall, packages, My Company Chicago).
Standard operation types: Receipts, Delivery Orders, Pick, Pack, Quality Control, Storage, Internal Transfers, Cross Dock, Pick Components, Store Finished Product, Manufacturing, Subcontracting, Resupply Subcontractor.
Custom operation types (Leen Textile only, part of the stage-transfer workflow): Stitching OUT, Packing IN, Embroidery OUT, Cutting IN, Cutting OUT.
Routes: Manufacture, Buy, Resupply Subcontractor on Order, plus per-warehouse Receive/Deliver/Manufacture steps.

6. CUSTOM MULTI-STAGE PRODUCTION WORKFLOW (production_stage_tracking module)
Finished goods move through sequential production stages, each its own linked MO: Cutting -> Embroidery -> Stitching -> Packing. Material moves between stages via stock transfers (custom operation types above). An MO cannot start until its incoming stage transfer(s) are Done and its Quality Check has passed. MO numbering carries a stage prefix that drives which stage it belongs to: CUTP-MO-XXXXX (Cutting), EMBP-MO-XXXXX (Embroidery), STIPR-MO-XXXXX (Stitching), PACKP-MO-XXXXX (Packing). Generic/non-staged MOs use WH/MO/00001. Backorders append -001, -002 etc (e.g. WH/MO/00006-002-001).

7. QUALITY CHECKS (custom model: leen.quality.check)
States: draft -> in_progress -> passed / failed (or cancel). Triggered by the stage workflow above — a Quality Check must be created and marked passed before production can start on a stage MO; a failed check blocks production until resolved. Tracked fields: passed_qty, failed_qty, rework_qty, checked_date.

8. CUSTOM FIELDS (not standard Odoo, all prefixed x_)
product.template: x_card_number, x_article_design_no, x_collection, x_product_group, x_brand, x_designer, x_product_type, x_fabric_type, x_fabric, x_pattern, x_season, x_product_line, x_internal_reference_base, x_product_number.
mrp.production: x_stage_parent_mo_id, x_stage_root_mo_id, x_stage_child_mo_ids, x_production_stage, x_article_number, x_card_number, x_availability_checked, x_incoming_stage_transfer_ids, x_outgoing_stage_transfer_ids, x_workflow_quality_check_ids, x_workflow_state, x_pending_transfer_count.
stock.picking: x_is_stage_transfer, x_stage_transfer_direction, x_stage_from, x_stage_to, x_stage_from_mo_id, x_stage_to_mo_id, x_stage_pair_picking_id, x_auto_stage_transfer.
purchase/sale (fg_purchase_production_report): x_fcr_purchase_id, x_fcr_purchase_line_id, x_fcr_sale_id, x_fcr_sale_line_id.

9. USER ROLES / ACCESS GROUPS
mrp.group_mrp_user (Manufacturing: User) — read access to custom costing/tracking reports.
mrp.group_mrp_manager (Manufacturing: Administrator) — full access to costing config.
account.group_account_user / account.group_account_readonly — accounting staff, read-only on costing reports.
base.group_system / base.group_user — standard Odoo Settings admin / Internal User.
purchase.group_purchase_manager — required for the PO "Approve Order" and "Unlock" buttons.

10. COMMON ERROR / VALIDATION MESSAGES (exact text, custom stage workflow)
"Complete the incoming stage transfer(s) first: [transfers]. After they are Done, click Check Availability."
"Material is not ready for [MO]. Complete the required transfers and then click Check Availability."
"Create and pass the Quality Check before starting [MO]."
"Production is blocked because Quality Check(s) failed: [checks]."
"Pass all Quality Checks before starting production: [checks]."
Native Odoo: a "Consumption Warning" wizard appears if actual material consumption differs from the BOM-expected quantity when marking an MO done.

11. NUMBERING / SEQUENCE CONVENTIONS
Manufacturing Orders: WH/MO/00001 generic, or stage-prefixed as in section 6.
Sales Orders: S00001. Purchase Orders: P00001. Internal transfers: INT/00001; warehouse receipts/deliveries use WH/IN/, WH/OUT/ etc per operation type. Unbuild: UB/00001. Scrap: SP/00001.`;

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

// Tried in order; if the first model errors, is rate-limited, or returns a
// response that doesn't parse as valid JSON, the next one is tried instead
// of surfacing an error to the employee.
const FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

async function callGroq(apiKey: string, model: string, systemPrompt: string, data: z.infer<typeof chatInputSchema>) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
    throw new Error(payload.error?.message ?? `AI model ${model} could not respond.`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`AI model ${model} returned an empty response.`);

  const parsed: unknown = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
  const result = chatResultSchema.parse(parsed);
  return result;
}

export const chatWithAssistant = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI assistant is not configured.");
    }

    const kbContext = await loadKbContext();
    const systemPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${ODOO_REFERENCE}` +
      (kbContext
        ? `\n\nReference knowledge base articles for this specific company — use these as your primary source of truth and prefer their documented steps over generic advice:\n\n${kbContext}`
        : "");

    let lastError: unknown;
    for (const model of FALLBACK_MODELS) {
      try {
        return await callGroq(apiKey, model, systemPrompt, data);
      } catch (error) {
        console.error(`[ai-chat] model ${model} failed, trying next fallback:`, error);
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("AI assistant could not respond. Please try again.");
  });

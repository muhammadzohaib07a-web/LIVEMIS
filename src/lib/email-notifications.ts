import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_URL = process.env.APP_URL ?? "https://livemis-utxn.vercel.app";

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email-notifications] RESEND_API_KEY is not configured; email skipped.");
    return;
  }
  const from = process.env.EMAIL_FROM ?? "MIS Support Hub <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[email-notifications] send to ${to} failed (${response.status}): ${body}`);
  }
}

function emailShell(heading: string, bodyHtml: string, link: string) {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1f2e;">
      <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">MIS Support Hub</p>
      <h2 style="margin:0 0 16px;font-size:18px;">${heading}</h2>
      ${bodyHtml}
      <a href="${link}" style="display:inline-block;margin-top:20px;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Open in MIS Support Hub
      </a>
    </div>
  `;
}

const ticketIdSchema = z.object({ ticketId: z.string().uuid() });

// Fires when a new ticket is reported: every MIS Head (admin) gets an email.
export const notifyNewTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("ticket_no, title, category, priority, user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) return;

    const [{ data: reporter }, { data: adminRoles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", ticket.user_id)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = (adminRoles ?? []).map((row) => row.user_id);
    if (adminIds.length === 0) return;

    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", adminIds);

    const link = `${APP_URL}/tickets/${data.ticketId}`;
    const html = emailShell(
      `New ticket ${ticket.ticket_no}`,
      `<p style="margin:0 0 8px;">
         <strong>${reporter?.full_name ?? reporter?.email ?? "An employee"}</strong> reported a new issue.
       </p>
       <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
       <p style="margin:4px 0;"><strong>Category:</strong> ${ticket.category} &middot; <strong>Priority:</strong> ${ticket.priority}</p>`,
      link,
    );

    await Promise.all(
      (admins ?? [])
        .filter((admin): admin is { email: string } => Boolean(admin.email))
        .map((admin) => sendEmail(admin.email, `New ticket ${ticket.ticket_no}: ${ticket.title}`, html)),
    );
  });

// Fires when the MIS Head assigns a ticket: the assigned agent gets an email.
export const notifyTicketAssigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ ticketId: z.string().uuid(), assigneeId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: ticket }, { data: assignee }] = await Promise.all([
      supabaseAdmin
        .from("tickets")
        .select("ticket_no, title, category, priority")
        .eq("id", data.ticketId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.assigneeId)
        .maybeSingle(),
    ]);
    if (!ticket || !assignee?.email) return;

    const link = `${APP_URL}/tickets/${data.ticketId}`;
    const html = emailShell(
      `Ticket ${ticket.ticket_no} assigned to you`,
      `<p style="margin:0 0 8px;">The MIS Head assigned you a support ticket.</p>
       <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
       <p style="margin:4px 0;"><strong>Category:</strong> ${ticket.category} &middot; <strong>Priority:</strong> ${ticket.priority}</p>`,
      link,
    );

    await sendEmail(assignee.email, `Ticket ${ticket.ticket_no} assigned to you`, html);
  });

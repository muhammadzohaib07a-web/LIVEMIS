import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailShell, sendEmail } from "@/lib/mailer.server";
import { sendPushToUser } from "@/lib/push.server";

const APP_URL = process.env.APP_URL ?? "https://livemis-utxn.vercel.app";

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
    const reporterName = reporter?.full_name ?? reporter?.email ?? "An employee";
    const html = emailShell(
      `New ticket ${ticket.ticket_no}`,
      `<p style="margin:0 0 8px;">
         <strong>${reporterName}</strong> reported a new issue.
       </p>
       <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
       <p style="margin:4px 0;"><strong>Category:</strong> ${ticket.category} &middot; <strong>Priority:</strong> ${ticket.priority}</p>`,
      link,
    );

    await Promise.all([
      ...(admins ?? [])
        .filter((admin): admin is { email: string } => Boolean(admin.email))
        .map((admin) => sendEmail(admin.email, `New ticket ${ticket.ticket_no}: ${ticket.title}`, html)),
      ...adminIds.map((adminId) =>
        sendPushToUser(adminId, {
          title: `New ticket ${ticket.ticket_no}`,
          body: `${reporterName}: ${ticket.title}`,
          url: `/tickets/${data.ticketId}`,
        }),
      ),
    ]);
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
    if (!ticket) return;

    const link = `${APP_URL}/tickets/${data.ticketId}`;
    const html = emailShell(
      `Ticket ${ticket.ticket_no} assigned to you`,
      `<p style="margin:0 0 8px;">The MIS Head assigned you a support ticket.</p>
       <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
       <p style="margin:4px 0;"><strong>Category:</strong> ${ticket.category} &middot; <strong>Priority:</strong> ${ticket.priority}</p>`,
      link,
    );

    await Promise.all([
      assignee?.email
        ? sendEmail(assignee.email, `Ticket ${ticket.ticket_no} assigned to you`, html)
        : Promise.resolve(),
      sendPushToUser(data.assigneeId, {
        title: `Ticket ${ticket.ticket_no} assigned to you`,
        body: ticket.title,
        url: `/tickets/${data.ticketId}`,
      }),
    ]);
  });

// Fires the moment MIS marks a ticket "Awaiting Customer Feedback": the
// employee gets an email right away, not just after the 1hr reminder.
export const notifyAwaitingFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(ticketIdSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("ticket_no, title, user_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) return;

    const { data: requester } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", ticket.user_id)
      .maybeSingle();
    // profiles.email can be blank for older/manually-created accounts; auth.users
    // always has the address the employee actually signs in with.
    let recipientEmail = requester?.email ?? null;
    if (!recipientEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(ticket.user_id);
      recipientEmail = authUser?.user?.email ?? null;
    }
    const link = `${APP_URL}/tickets/${data.ticketId}`;
    const html = emailShell(
      `Ticket ${ticket.ticket_no} needs your feedback`,
      `<p style="margin:0 0 8px;">MIS believes this issue is resolved and is waiting for your confirmation.</p>
       <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
       <p style="margin:12px 0 0;">Please confirm whether the issue is fixed, or let us know it's still not working.</p>`,
      link,
    );

    await Promise.all([
      recipientEmail
        ? sendEmail(recipientEmail, `Ticket ${ticket.ticket_no} needs your feedback`, html)
        : Promise.resolve(),
      sendPushToUser(ticket.user_id, {
        title: `Ticket ${ticket.ticket_no} needs your feedback`,
        body: ticket.title,
        url: `/tickets/${data.ticketId}`,
      }),
    ]);
  });

// Fires on every chat reply: push-only (no email for this one), mirrors the
// same routing the notify_on_ticket_message DB trigger uses for the in-app
// bell — reporter's own message goes to the assignee (or every admin if
// still unassigned); MIS staff's reply goes to the reporter. Admins always
// get a copy either way, since the Head oversees every ticket.
export const notifyNewMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ ticketId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: ticket }, { data: sender }, { data: adminRoles }] = await Promise.all([
      supabaseAdmin
        .from("tickets")
        .select("ticket_no, user_id, assignee_id")
        .eq("id", data.ticketId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    if (!ticket) return;

    const senderName = sender?.full_name ?? sender?.email ?? "Someone";
    const recipients = new Set<string>();
    if (context.userId === ticket.user_id) {
      if (ticket.assignee_id) recipients.add(ticket.assignee_id);
    } else {
      recipients.add(ticket.user_id);
    }
    for (const row of adminRoles ?? []) recipients.add(row.user_id);
    recipients.delete(context.userId);

    await Promise.all(
      [...recipients].map((userId) =>
        sendPushToUser(userId, {
          title: `${senderName} replied on ${ticket.ticket_no}`,
          body: "Tap to view the conversation.",
          url: `/tickets/${data.ticketId}`,
        }),
      ),
    );
  });

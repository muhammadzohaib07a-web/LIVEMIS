import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailShell, sendEmail } from "@/lib/mailer.server";

const APP_URL = process.env.APP_URL ?? "https://livemis-utxn.vercel.app";
const REMINDER_AFTER_MS = 60 * 60 * 1000;

// Fires from the employee dashboard on load. For every ticket of theirs stuck
// in awaiting_feedback for over an hour, sends one reminder (notification +
// email) per awaiting_feedback cycle — a matching notification already
// existing since ticket.updated_at means this cycle was already reminded.
export const sendFeedbackReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const cutoff = new Date(Date.now() - REMINDER_AFTER_MS).toISOString();

    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("id, ticket_no, title, updated_at")
      .eq("user_id", userId)
      .eq("status", "awaiting_feedback")
      .lte("updated_at", cutoff);

    if (!tickets || tickets.length === 0) return;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    // profiles.email can be blank for older/manually-created accounts; auth.users
    // always has the address the employee actually signs in with.
    let recipientEmail = profile?.email ?? null;
    if (!recipientEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      recipientEmail = authUser?.user?.email ?? null;
    }

    for (const ticket of tickets) {
      const link = `/tickets/${ticket.id}`;
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("link", link)
        .ilike("title", "Reminder:%")
        .gte("created_at", ticket.updated_at)
        .limit(1);
      if (existing && existing.length > 0) continue;

      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: `Reminder: Ticket ${ticket.ticket_no} awaiting your feedback`,
        body: ticket.title,
        link,
      });

      if (recipientEmail) {
        const html = emailShell(
          `Ticket ${ticket.ticket_no} is waiting on your feedback`,
          `<p style="margin:0 0 8px;">It's been over an hour since MIS marked this ticket as resolved and awaiting your confirmation.</p>
           <p style="margin:4px 0;"><strong>Title:</strong> ${ticket.title}</p>
           <p style="margin:12px 0 0;">Please confirm whether the issue is fixed, or let us know it's still not working.</p>`,
          `${APP_URL}${link}`,
        );
        await sendEmail(
          recipientEmail,
          `Reminder: Ticket ${ticket.ticket_no} awaiting your feedback`,
          html,
        );
      } else {
        console.error("[sendFeedbackReminders] no email on file for user:", userId);
      }
    }
  });

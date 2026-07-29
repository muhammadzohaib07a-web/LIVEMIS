import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEMO_USER_PASSWORD",
  "ADMIN_TEST_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const demoPassword = process.env.DEMO_USER_PASSWORD.trim();
const adminPassword = process.env.ADMIN_TEST_PASSWORD.trim();

function createSupabaseFetch(apiKey) {
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    if (apiKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function makeClient(apiKey) {
  return createClient(supabaseUrl, apiKey, {
    global: { fetch: createSupabaseFetch(apiKey) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(email, password = demoPassword) {
  const client = makeClient(publishableKey);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) throw error ?? new Error(`Could not sign in ${email}`);
  return { client, user: data.user };
}

async function updateStatus(client, ticketId, status) {
  const { error } = await client.from("tickets").update({ status }).eq("id", ticketId);
  if (error) throw error;
}

async function expectStatusRejected(client, ticketId, status, actorLabel) {
  const { error } = await client.from("tickets").update({ status }).eq("id", ticketId);
  if (!error) {
    throw new Error(`${actorLabel} unexpectedly changed the ticket to ${status}`);
  }
  if (!error.message.toLowerCase().includes("only the mis head/admin")) {
    throw new Error(`${actorLabel} was rejected for an unexpected reason: ${error.message}`);
  }
}

const productionTicketId = "00000000-0000-4000-8000-000000000102";
const closedTicketId = "00000000-0000-4000-8000-000000000103";
const followUpTicketId = "00000000-0000-4000-8000-000000000104";

try {
  const admin = makeClient(serviceKey);
  await admin.from("notifications").delete().eq("link", `/tickets/${followUpTicketId}`);
  await admin.from("ticket_messages").delete().eq("ticket_id", followUpTicketId);
  await admin.from("tickets").delete().eq("id", followUpTicketId);

  const agent = await signIn("muhammadzohaib07a@gmail.com");
  await updateStatus(agent.client, productionTicketId, "answered");
  await updateStatus(agent.client, productionTicketId, "awaiting_feedback");
  await expectStatusRejected(agent.client, productionTicketId, "closed", "MIS Agent");

  const productionEmployee = await signIn("talenthubpro78+production@gmail.com");
  await expectStatusRejected(productionEmployee.client, productionTicketId, "closed", "Employee");

  const confirmationBody = "✅ Customer confirmation: The issue is fixed. MIS Head may close it.";
  const { error: confirmationError } = await productionEmployee.client
    .from("ticket_messages")
    .insert({
      ticket_id: productionTicketId,
      sender_id: productionEmployee.user.id,
      body: confirmationBody,
    });
  if (confirmationError) throw confirmationError;

  const misHead = await signIn("talenthubpro78@gmail.com", adminPassword);
  await updateStatus(misHead.client, productionTicketId, "closed");

  const accountsEmployee = await signIn("talenthubpro78+attique@gmail.com");
  const followUpReason =
    "The corrected ledger is accurate. Please also add a separate vendor-wise variance column to the same report.";
  const { error: followUpError } = await accountsEmployee.client.from("tickets").insert({
    id: followUpTicketId,
    ticket_no: "DEMO-004",
    user_id: accountsEmployee.user.id,
    assignee_id: null,
    title: "Follow-up: Accounts monthly ledger report",
    description: followUpReason,
    follow_up_reason: followUpReason,
    parent_ticket_id: closedTicketId,
    category: "odoo",
    priority: "medium",
    status: "open",
    attachments: [],
  });
  if (followUpError) throw followUpError;

  const { data: results, error: readError } = await admin
    .from("tickets")
    .select("ticket_no, status, parent_ticket_id, follow_up_reason")
    .in("id", [productionTicketId, closedTicketId, followUpTicketId])
    .order("ticket_no");
  if (readError) throw readError;

  const { data: adminNotifications, error: notificationError } = await admin
    .from("notifications")
    .select("title, body")
    .eq("user_id", misHead.user.id)
    .eq("link", `/tickets/${productionTicketId}`)
    .ilike("title", "Customer feedback on %")
    .order("created_at", { ascending: false })
    .limit(1);
  if (notificationError) throw notificationError;
  if (!adminNotifications?.length) {
    throw new Error("MIS Head did not receive the customer confirmation notification");
  }

  console.log("Verified real-session admin-only close workflow:");
  console.log("- MIS Agent: In Progress -> Answered -> Awaiting Customer Feedback");
  console.log("- MIS Agent: Close rejected by database");
  console.log("- Employee: Close rejected by database");
  console.log("- Employee: Issue Fixed confirmation notified MIS Head");
  console.log("- MIS Head/Admin: Close accepted by database");
  console.log("- Employee: Closed ticket -> linked Open follow-up");
  console.log(JSON.stringify(results, null, 2));

  const { error: resetError } = await admin
    .from("tickets")
    .update({ status: "in_progress" })
    .eq("id", productionTicketId);
  if (resetError) throw resetError;
} catch (error) {
  console.error(
    `Lifecycle verification failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DEMO_USER_PASSWORD"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const demoPassword = process.env.DEMO_USER_PASSWORD.trim();

if (demoPassword.length < 8 || demoPassword.length > 72) {
  console.error("DEMO_USER_PASSWORD must contain between 8 and 72 characters.");
  process.exit(1);
}

function isOpaqueSupabaseKey(value) {
  return value.startsWith("sb_secret_") || value.startsWith("sb_publishable_");
}

function supabaseFetch(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

  if (isOpaqueSupabaseKey(serviceKey) && headers.get("Authorization") === `Bearer ${serviceKey}`) {
    headers.delete("Authorization");
  }

  headers.set("apikey", serviceKey);
  return fetch(input, { ...init, headers });
}

const supabase = createClient(supabaseUrl, serviceKey, {
  global: { fetch: supabaseFetch },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const demoUsers = [
  {
    email: "muhammadzohaib07a@gmail.com",
    fullName: "Muhammad Zohaib",
    employeeId: "MIS-AGENT-01",
    department: "MIS",
    role: "agent",
  },
  {
    email: "talenthubpro78+attique@gmail.com",
    fullName: "Attique Shb",
    employeeId: "ACC-0101",
    department: "Accounts",
    role: "employee",
  },
  {
    email: "talenthubpro78+production@gmail.com",
    fullName: "Adeel Production",
    employeeId: "PROD-0201",
    department: "Production",
    role: "employee",
  },
  {
    email: "talenthubpro78+warehouse@gmail.com",
    fullName: "Hamza Warehouse",
    employeeId: "WH-0301",
    department: "Warehouse",
    role: "employee",
  },
];

async function listAllUsers() {
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function ensureUser(definition, existingUsers) {
  const existing = existingUsers.find(
    (user) => user.email?.toLowerCase() === definition.email.toLowerCase(),
  );
  const attributes = {
    email_confirm: true,
    password: demoPassword,
    user_metadata: {
      full_name: definition.fullName,
      employee_id: definition.employeeId,
      department: definition.department,
    },
  };

  let user;
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: definition.email,
      ...attributes,
    });
    if (error || !data.user) throw error ?? new Error(`Could not create ${definition.email}`);
    user = data.user;
    existingUsers.push(user);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: definition.email,
    full_name: definition.fullName,
    employee_id: definition.employeeId,
    department: definition.department,
  });
  if (profileError) throw profileError;

  const { error: deleteRoleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", user.id);
  if (deleteRoleError) throw deleteRoleError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: user.id, role: definition.role });
  if (roleError) throw roleError;

  return { ...definition, id: user.id };
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function seedTickets(users) {
  const agent = users.find((user) => user.role === "agent");
  const attique = users.find((user) => user.fullName === "Attique Shb");
  const production = users.find((user) => user.department === "Production");
  const warehouse = users.find((user) => user.department === "Warehouse");

  if (!agent || !attique || !production || !warehouse) {
    throw new Error("Required demo identities could not be prepared.");
  }

  const ticketIds = [
    "00000000-0000-4000-8000-000000000101",
    "00000000-0000-4000-8000-000000000102",
    "00000000-0000-4000-8000-000000000103",
  ];
  const links = ticketIds.map((id) => `/tickets/${id}`);

  const { error: notificationDeleteError } = await supabase
    .from("notifications")
    .delete()
    .in("link", links);
  if (notificationDeleteError) throw notificationDeleteError;

  const { error: messageDeleteError } = await supabase
    .from("ticket_messages")
    .delete()
    .in("ticket_id", ticketIds);
  if (messageDeleteError) throw messageDeleteError;

  const { error: ticketDeleteError } = await supabase.from("tickets").delete().in("id", ticketIds);
  if (ticketDeleteError) throw ticketDeleteError;

  const tickets = [
    {
      id: ticketIds[0],
      ticket_no: "DEMO-001",
      user_id: warehouse.id,
      assignee_id: null,
      title: "Warehouse barcode printer stops after each label",
      description:
        "The dispatch barcode printer produces one label and then goes offline. Restarting it works briefly, but the same issue returns on the next carton.",
      category: "printer",
      priority: "high",
      status: "open",
      attachments: [],
      created_at: isoMinutesAgo(90),
      updated_at: isoMinutesAgo(90),
    },
    {
      id: ticketIds[1],
      ticket_no: "DEMO-002",
      user_id: production.id,
      assignee_id: null,
      title: "Odoo production orders are not syncing",
      description:
        "Completed work orders from weaving line 2 are still showing as pending in Odoo. Production totals and material consumption are not updating.",
      category: "odoo",
      priority: "urgent",
      status: "open",
      attachments: [],
      created_at: isoMinutesAgo(70),
      updated_at: isoMinutesAgo(70),
    },
    {
      id: ticketIds[2],
      ticket_no: "DEMO-003",
      user_id: attique.id,
      assignee_id: null,
      title: "Accounts monthly ledger report shows duplicate entries",
      description:
        "The June ledger export contains repeated vendor lines and the closing balance does not match the Odoo trial balance. Please verify the report query.",
      category: "odoo",
      priority: "high",
      status: "open",
      attachments: [],
      created_at: isoMinutesAgo(180),
      updated_at: isoMinutesAgo(180),
    },
  ];

  const { error: ticketInsertError } = await supabase.from("tickets").insert(tickets);
  if (ticketInsertError) throw ticketInsertError;

  const { error: firstMessageError } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketIds[0],
    sender_id: warehouse.id,
    body: "The printer is WH-LABEL-02 near dispatch bay 3. The red network light starts blinking after the first label.",
    created_at: isoMinutesAgo(85),
  });
  if (firstMessageError) throw firstMessageError;

  const { error: assignProductionError } = await supabase
    .from("tickets")
    .update({
      assignee_id: agent.id,
      status: "in_progress",
      updated_at: isoMinutesAgo(50),
    })
    .eq("id", ticketIds[1]);
  if (assignProductionError) throw assignProductionError;

  const { error: productionMessagesError } = await supabase.from("ticket_messages").insert([
    {
      ticket_id: ticketIds[1],
      sender_id: production.id,
      body: "Line 2 supervisor confirms 14 completed orders are affected since the morning shift.",
      created_at: isoMinutesAgo(65),
    },
    {
      ticket_id: ticketIds[1],
      sender_id: agent.id,
      body: "I have taken this task. The Odoo queue worker is being checked and production can continue recording orders.",
      created_at: isoMinutesAgo(45),
    },
  ]);
  if (productionMessagesError) throw productionMessagesError;

  const { error: assignAccountsError } = await supabase
    .from("tickets")
    .update({
      assignee_id: agent.id,
      status: "in_progress",
      updated_at: isoMinutesAgo(150),
    })
    .eq("id", ticketIds[2]);
  if (assignAccountsError) throw assignAccountsError;

  const { error: accountsMessagesError } = await supabase.from("ticket_messages").insert([
    {
      ticket_id: ticketIds[2],
      sender_id: attique.id,
      body: "The duplicate entries appear only when the report includes both posted and draft adjustments.",
      created_at: isoMinutesAgo(175),
    },
    {
      ticket_id: ticketIds[2],
      sender_id: agent.id,
      body: "The report domain was including reversed draft moves. I have corrected the Odoo filter and regenerated the ledger.",
      created_at: isoMinutesAgo(130),
    },
    {
      ticket_id: ticketIds[2],
      sender_id: attique.id,
      body: "Verified. The vendor totals and closing balance are correct now.",
      created_at: isoMinutesAgo(110),
    },
    {
      ticket_id: ticketIds[2],
      sender_id: agent.id,
      body: "Confirmed by Accounts. Marking this issue as resolved.",
      created_at: isoMinutesAgo(100),
    },
  ]);
  if (accountsMessagesError) throw accountsMessagesError;

  const { error: answerAccountsError } = await supabase
    .from("tickets")
    .update({ status: "answered", updated_at: isoMinutesAgo(105) })
    .eq("id", ticketIds[2]);
  if (answerAccountsError) throw answerAccountsError;

  const { error: requestFeedbackError } = await supabase
    .from("tickets")
    .update({ status: "awaiting_feedback", updated_at: isoMinutesAgo(100) })
    .eq("id", ticketIds[2]);
  if (requestFeedbackError) throw requestFeedbackError;

  const { error: closeAccountsError } = await supabase
    .from("tickets")
    .update({ status: "closed", updated_at: isoMinutesAgo(95) })
    .eq("id", ticketIds[2]);
  if (closeAccountsError) throw closeAccountsError;

  const { data: seededTickets, error: readError } = await supabase
    .from("tickets")
    .select("ticket_no, title, status, priority, assignee_id")
    .in("id", ticketIds)
    .order("ticket_no");
  if (readError) throw readError;
  return seededTickets;
}

try {
  const existingUsers = await listAllUsers();
  const preparedUsers = [];
  for (const definition of demoUsers) {
    preparedUsers.push(await ensureUser(definition, existingUsers));
  }

  const tickets = await seedTickets(preparedUsers);
  const allUsers = await listAllUsers();

  console.log(`Total authentication users: ${allUsers.length}`);
  console.log("Demo identities:");
  for (const user of preparedUsers) {
    console.log(`- ${user.fullName} · ${user.role} · ${user.department} · ${user.email}`);
  }
  console.log("Seeded ticket flow:");
  for (const ticket of tickets) {
    console.log(`- ${ticket.ticket_no} · ${ticket.status} · ${ticket.title}`);
  }
} catch (error) {
  console.error(`Demo seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

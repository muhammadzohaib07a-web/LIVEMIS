import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INITIAL_ADMIN_PASSWORD"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  console.error("Add them to .env.local, then run `npm run bootstrap:admin` again.");
  process.exit(1);
}

const email = (process.env.INITIAL_ADMIN_EMAIL ?? "talenthubpro78@gmail.com").trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD.trim();
const fullName = (process.env.INITIAL_ADMIN_FULL_NAME ?? "Tahir Ghaffar").trim();
const employeeId = (process.env.INITIAL_ADMIN_EMPLOYEE_ID ?? "MIS-HEAD-01").trim();
const supabaseUrl = process.env.SUPABASE_URL.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

if (!email.endsWith("@gmail.com")) {
  console.error("INITIAL_ADMIN_EMAIL must be a valid Gmail address.");
  process.exit(1);
}

if (password.length < 8 || password.length > 72) {
  console.error("INITIAL_ADMIN_PASSWORD must contain between 8 and 72 characters.");
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

async function findUserByEmail() {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match || data.users.length < 1000) return match;
  }

  throw new Error("Could not search all authentication users.");
}

async function ensureAuthUser() {
  const existing = await findUserByEmail();
  const attributes = {
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName,
      employee_id: employeeId,
      department: "MIS",
    },
  };

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    ...attributes,
  });
  if (error || !data.user) throw error ?? new Error("Admin account could not be created.");
  return { user: data.user, created: true };
}

try {
  const { user, created } = await ensureAuthUser();

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email,
    full_name: fullName,
    employee_id: employeeId,
    department: "MIS",
  });
  if (profileError) throw profileError;

  const { error: deleteRoleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", user.id);
  if (deleteRoleError) throw deleteRoleError;

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: user.id, role: "admin" });
  if (roleError) throw roleError;

  console.log(`${created ? "Created" : "Updated"} confirmed MIS Head admin: ${email}`);
  console.log(`Profile: ${fullName} · ${employeeId} · MIS`);
  console.log("The password was not printed or exposed.");
} catch (error) {
  console.error(
    `Admin bootstrap failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

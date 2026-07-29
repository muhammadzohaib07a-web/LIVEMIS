import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

function supabaseFetch(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  if (headers.get("Authorization") === `Bearer ${serviceKey}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", serviceKey);
  return fetch(input, { ...init, headers });
}

const supabase = createClient(supabaseUrl, serviceKey, {
  global: { fetch: supabaseFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const [{ data: authData, error: authError }, { data: profiles }, { data: roles }] =
    await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("id, email, full_name, department"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
  if (authError) throw authError;

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const roleMap = new Map((roles ?? []).map((role) => [role.user_id, role.role]));
  const users = authData.users.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      email: user.email,
      fullName: profile?.full_name ?? null,
      department: profile?.department ?? null,
      role: roleMap.get(user.id) ?? null,
      confirmed: Boolean(user.email_confirmed_at),
    };
  });

  console.log(JSON.stringify(users, null, 2));
  console.log(`TOTAL_USERS=${users.length}`);
} catch (error) {
  console.error(`User audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

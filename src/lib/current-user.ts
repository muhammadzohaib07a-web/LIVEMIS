import { supabase } from "@/integrations/supabase/client";
import { getPreviewRole, isPreviewMode } from "@/lib/preview-auth";

export type AppRole = "admin" | "agent" | "employee";

export type CurrentUserContext = {
  id: string;
  role: AppRole;
  fullName: string | null;
  email: string | null;
  department: string | null;
};

export function isMisStaff(role: AppRole) {
  return role === "agent" || role === "admin";
}

// Every route calls this on mount. Without caching, switching tabs re-runs
// the same auth.getUser() + profiles + user_roles round-trip every single
// time, which is what made navigation feel slow. A short TTL keeps it fresh
// enough for role/profile changes while eliminating redundant refetches.
const CACHE_TTL_MS = 30_000;
let cachedContext: { value: CurrentUserContext | null; expiresAt: number } | null = null;
let inFlightRequest: Promise<CurrentUserContext | null> | null = null;

export function invalidateCurrentUserContext() {
  cachedContext = null;
  inFlightRequest = null;
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  if (isPreviewMode()) {
    const role = getPreviewRole();
    const id =
      role === "admin" ? "preview-head" : role === "agent" ? "preview-agent-1" : "preview-employee";
    return {
      id,
      role,
      fullName:
        role === "admin" ? "Tahir Ghaffar" : role === "agent" ? "Muhammad Zohaib" : "Attique Shb",
      email:
        role === "admin"
          ? "mis.head@mill.local"
          : role === "agent"
            ? "zohaib.mis@mill.local"
            : "employee.preview@mill.local",
      department: role === "employee" ? "Production" : "MIS",
    };
  }

  if (cachedContext && cachedContext.expiresAt > Date.now()) {
    return cachedContext.value;
  }
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      inFlightRequest = null;
      return null;
    }

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, department")
        .eq("id", authData.user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
    ]);

    const roleNames = (roles ?? []).map((item) => item.role);
    const role: AppRole = roleNames.includes("admin")
      ? "admin"
      : roleNames.includes("agent")
        ? "agent"
        : "employee";

    const context: CurrentUserContext = {
      id: authData.user.id,
      role,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? authData.user.email ?? null,
      department: profile?.department ?? null,
    };
    cachedContext = { value: context, expiresAt: Date.now() + CACHE_TTL_MS };
    inFlightRequest = null;
    return context;
  })();

  return inFlightRequest;
}

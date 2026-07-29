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

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

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

  return {
    id: authData.user.id,
    role,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? authData.user.email ?? null,
    department: profile?.department ?? null,
  };
}

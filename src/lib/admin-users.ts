import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const roleSchema = z.enum(["admin", "agent", "employee"]);
const departmentSchema = z.string().trim().min(2).max(100);

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  employeeId: z.string().trim().min(2).max(40),
  department: departmentSchema,
  role: roleSchema,
  temporaryPassword: z.string().min(8).max(72),
});

const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
});

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  temporaryPassword: z.string().min(8).max(72),
});

const changeDepartmentSchema = z.object({
  userId: z.string().uuid(),
  department: departmentSchema,
});

const changeEmailSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});

const changeNameSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
});

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string | null;
  employeeId: string | null;
  department: string | null;
  role: "admin" | "agent" | "employee";
  confirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Only the MIS Head can manage user accounts.");
}

async function assertActiveDepartment(supabase: SupabaseClient<Database>, department: string) {
  const { data, error } = await supabase
    .from("departments")
    .select("name")
    .eq("name", department)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) throw new Error("Select an active company department.");
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: authData, error: authError }, { data: profiles }, { data: roles }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("id, full_name, employee_id, department, email"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);
    if (authError) throw new Error(authError.message);

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const roleMap = new Map<string, ManagedUser["role"]>();
    for (const row of roles ?? []) {
      const current = roleMap.get(row.user_id);
      if (row.role === "admin" || (row.role === "agent" && current !== "admin") || !current) {
        roleMap.set(row.user_id, row.role);
      }
    }

    return authData.users
      .map((user): ManagedUser => {
        const profile = profileMap.get(user.id);
        return {
          id: user.id,
          email: profile?.email ?? user.email ?? "",
          fullName: profile?.full_name ?? user.user_metadata?.full_name ?? null,
          employeeId: profile?.employee_id ?? null,
          department: profile?.department ?? null,
          role: roleMap.get(user.id) ?? "employee",
          confirmed: Boolean(user.email_confirmed_at),
          lastSignInAt: user.last_sign_in_at ?? null,
          createdAt: user.created_at,
        };
      })
      .sort((left, right) => left.fullName?.localeCompare(right.fullName ?? "") ?? 0);
  });

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(createUserSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const department = data.role === "employee" ? data.department : "MIS";
    await assertActiveDepartment(supabaseAdmin, department);
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        employee_id: data.employeeId,
        department,
      },
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Account could not be created.");
    }

    const userId = created.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      employee_id: data.employeeId,
      department,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profileError.message);
    }

    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (deleteRoleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(deleteRoleError.message);
    }
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleError.message);
    }

    return { id: userId, email: data.email };
  });

export const changeManagedUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(changeRoleSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("The active MIS Head cannot remove their own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);
    if (data.role !== "employee") {
      await supabaseAdmin.from("profiles").update({ department: "MIS" }).eq("id", data.userId);
    }
    return { success: true };
  });

export const changeManagedUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(changeEmailSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email,
      email_confirm: true,
    });
    if (authError) throw new Error(authError.message);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: data.email })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    return { success: true };
  });

export const changeManagedUserName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(changeNameSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    const { data: authUser, error: authReadError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (authReadError) throw new Error(authReadError.message);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: { ...(authUser.user.user_metadata ?? {}), full_name: data.fullName },
    });
    if (authError) throw new Error(authError.message);
    return { success: true };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(deleteUserSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      throw new Error(
        `Could not delete this account (${error.message}). They may have existing tickets or ` +
          "messages that reference this profile — reassign or resolve those first.",
      );
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    return { success: true };
  });

export const resetManagedUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(resetPasswordSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.temporaryPassword,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const changeManagedUserDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(changeDepartmentSchema)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertActiveDepartment(supabaseAdmin, data.department);
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (targetRole?.role !== "employee") {
      throw new Error("MIS staff remain assigned to the MIS department.");
    }
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ department: data.department })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);
    const { data: authUser, error: authReadError } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    if (authReadError) throw new Error(authReadError.message);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      user_metadata: {
        ...(authUser.user.user_metadata ?? {}),
        department: data.department,
      },
    });
    if (authError) throw new Error(authError.message);
    return { success: true };
  });

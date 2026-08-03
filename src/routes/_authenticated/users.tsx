import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clipboard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  changeManagedUserDepartment,
  changeManagedUserEmail,
  changeManagedUserRole,
  createManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
  type ManagedUser,
} from "@/lib/admin-users";
import { getCurrentUserContext, type AppRole } from "@/lib/current-user";
import { FALLBACK_DEPARTMENTS, loadDepartments, type DepartmentOption } from "@/lib/departments";
import { isPreviewMode } from "@/lib/preview-auth";
import { previewAgents, previewRequesters } from "@/lib/preview-data";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User Management — MIS Support Hub" },
      {
        name: "description",
        content: "MIS Head account and department user administration.",
      },
    ],
  }),
  component: UserManagementPage,
});

type DepartmentFilter = string;
type RoleFilter = "all" | AppRole;

const roleStyles: Record<AppRole, string> = {
  admin: "border-accent/35 bg-accent/10 text-accent",
  agent: "border-primary/35 bg-primary/10 text-primary",
  employee: "border-border bg-muted/60 text-muted-foreground",
};

function getPreviewUsers(): ManagedUser[] {
  const now = new Date().toISOString();
  return [
    {
      id: "preview-head",
      email: "talenthubpro78@gmail.com",
      fullName: "Tahir Ghaffar",
      employeeId: "MIS-HEAD-01",
      department: "MIS",
      role: "admin",
      confirmed: true,
      lastSignInAt: now,
      createdAt: now,
    },
    ...previewAgents.map((agent, index): ManagedUser => ({
      id: agent.id,
      email: agent.email,
      fullName: agent.full_name,
      employeeId: `MIS-${String(index + 1).padStart(3, "0")}`,
      department: "MIS",
      role: "agent",
      confirmed: true,
      lastSignInAt: index === 0 ? now : null,
      createdAt: now,
    })),
    ...Object.entries(previewRequesters).map(([id, profile], index): ManagedUser => ({
      id,
      email: profile.email,
      fullName: profile.full_name,
      employeeId: `EMP-${String(index + 101).padStart(3, "0")}`,
      department: profile.department,
      role: "employee",
      confirmed: true,
      lastSignInAt: index === 0 ? now : null,
      createdAt: now,
    })),
  ];
}

function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>(FALLBACK_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("Production");
  const [role, setRole] = useState<AppRole>("employee");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [emailUser, setEmailUser] = useState<ManagedUser | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (isPreviewMode()) {
        setUsers(getPreviewUsers());
      } else {
        const [managedUsers, departmentOptions] = await Promise.all([
          listManagedUsers(),
          loadDepartments(),
        ]);
        setUsers(managedUsers);
        setDepartments(departmentOptions);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User accounts could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPreviewOnly(isPreviewMode());
    void getCurrentUserContext().then((context) => {
      if (context?.role !== "admin") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      void loadUsers();
    });
  }, [navigate]);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (departmentFilter !== "all" && user.department !== departmentFilter) return false;
        if (roleFilter !== "all" && user.role !== roleFilter) return false;
        if (
          query &&
          !`${user.fullName} ${user.email} ${user.employeeId}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          return false;
        return true;
      }),
    [users, departmentFilter, roleFilter, query],
  );

  const departmentCounts = useMemo(
    () =>
      Object.fromEntries(
        departments.map((item) => [
          item.name,
          users.filter((user) => user.department === item.name).length,
        ]),
      ),
    [users, departments],
  );

  const submitNewUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (temporaryPassword.length < 8) {
      toast.error("Temporary password must contain at least 8 characters");
      return;
    }
    setCreating(true);
    const issuedEmail = email.trim().toLowerCase();
    const issuedPassword = temporaryPassword;
    try {
      if (isPreviewMode()) {
        const now = new Date().toISOString();
        setUsers((current) => [
          {
            id: crypto.randomUUID(),
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            employeeId: employeeId.trim(),
            department: role === "employee" ? department : "MIS",
            role,
            confirmed: true,
            lastSignInAt: null,
            createdAt: now,
          },
          ...current,
        ]);
      } else {
        await createManagedUser({
          data: {
            fullName,
            email,
            employeeId,
            department: role === "employee" ? department : "MIS",
            role,
            temporaryPassword,
          },
        });
        await loadUsers();
      }
      setFullName("");
      setEmail("");
      setEmployeeId("");
      setTemporaryPassword("");
      setRole("employee");
      setDepartment("Production");
      setShowCreate(false);
      setShowTemporaryPassword(false);
      setIssuedCredentials({ email: issuedEmail, password: issuedPassword });
      toast.success(
        isPreviewMode()
          ? "Demo user added to this preview only — no real login was created"
          : "Confirmed account created and ready for sign in",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account could not be created");
    } finally {
      setCreating(false);
    }
  };

  const submitPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser || resetPassword.length < 8) {
      toast.error("Temporary password must contain at least 8 characters");
      return;
    }
    setResetting(true);
    try {
      if (!isPreviewMode()) {
        await resetManagedUserPassword({
          data: { userId: resetUser.id, temporaryPassword: resetPassword },
        });
      }
      setIssuedCredentials({ email: resetUser.email, password: resetPassword });
      setResetUser(null);
      setResetPassword("");
      setShowResetPassword(false);
      toast.success(
        isPreviewMode()
          ? "Demo password reset shown for preview only"
          : "Temporary password reset successfully",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be reset");
    } finally {
      setResetting(false);
    }
  };

  const submitEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!emailUser || !cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setChangingEmail(true);
    try {
      if (isPreviewMode()) {
        setUsers((current) =>
          current.map((item) => (item.id === emailUser.id ? { ...item, email: cleanEmail } : item)),
        );
      } else {
        await changeManagedUserEmail({ data: { userId: emailUser.id, email: cleanEmail } });
        await loadUsers();
      }
      toast.success(
        isPreviewMode()
          ? "Demo email change shown for preview only"
          : `Email updated to ${cleanEmail}`,
      );
      setEmailUser(null);
      setNewEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be updated");
    } finally {
      setChangingEmail(false);
    }
  };

  const copyCredentials = async () => {
    if (!issuedCredentials) return;
    await navigator.clipboard.writeText(
      `Email: ${issuedCredentials.email}\nTemporary password: ${issuedCredentials.password}`,
    );
    toast.success("Login credentials copied");
  };

  const updateRole = async (user: ManagedUser, nextRole: AppRole) => {
    if (user.role === nextRole) return;
    try {
      if (isPreviewMode()) {
        setUsers((current) =>
          current.map((item) =>
            item.id === user.id
              ? {
                  ...item,
                  role: nextRole,
                  department: nextRole === "employee" ? item.department : "MIS",
                }
              : item,
          ),
        );
      } else {
        await changeManagedUserRole({ data: { userId: user.id, role: nextRole } });
        await loadUsers();
      }
      toast.success(`${user.fullName ?? user.email} is now ${nextRole}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Role could not be updated");
    }
  };

  const updateDepartment = async (user: ManagedUser, nextDepartment: string) => {
    if (user.department === nextDepartment || user.role !== "employee") return;
    try {
      if (isPreviewMode()) {
        setUsers((current) =>
          current.map((item) =>
            item.id === user.id ? { ...item, department: nextDepartment } : item,
          ),
        );
      } else {
        await changeManagedUserDepartment({
          data: { userId: user.id, department: nextDepartment },
        });
        await loadUsers();
      }
      toast.success(`${user.fullName ?? user.email} moved to ${nextDepartment}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Department could not be updated");
    }
  };

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">MIS Head administration</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">User Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Create confirmed accounts, organize employees by department, and control MIS roles.
          </p>
        </div>
        <Button onClick={() => setShowCreate((current) => !current)}>
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? "Close form" : "Create account"}
        </Button>
      </div>

      <section className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">Tahir Ghaffar</p>
              <p className="text-xs text-muted-foreground">MIS Head · Primary Administrator</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-5 text-center">
            <div>
              <p className="text-xl font-bold">{users.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Users</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {users.filter((user) => user.role === "agent").length}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Agents</p>
            </div>
            <div>
              <p className="text-xl font-bold">{users.filter((user) => user.confirmed).length}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
      </section>

      {previewOnly && (
        <div className="mb-6 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm">
          <p className="font-bold text-foreground">MIS Head Preview — demo data only</p>
          <p className="mt-1 text-muted-foreground">
            Users added here are not written to Supabase and cannot sign in. Configure the
            server-only Supabase service key, then sign in with the real MIS Head account to create
            confirmed login accounts.
          </p>
        </div>
      )}

      {issuedCredentials && (
        <div className="mb-6 rounded-2xl border border-success/35 bg-success/10 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold text-foreground">Temporary credentials — shown once</p>
              <p className="mt-1 text-sm text-muted-foreground">{issuedCredentials.email}</p>
              <p className="mt-1 font-mono text-sm font-bold text-foreground">
                {issuedCredentials.password}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Share securely. The password cannot be retrieved after this message is dismissed.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void copyCredentials()}>
                <Clipboard className="mr-2 h-4 w-4" /> Copy
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIssuedCredentials(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={submitNewUser}
          className="mb-6 space-y-5 rounded-2xl border border-border bg-surface/70 p-5 shadow-card"
        >
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <UserCog className="h-5 w-5 text-primary" /> Create a managed account
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {previewOnly
                ? "Preview mode adds a demo row only; it does not create a login."
                : "The account is confirmed immediately and can sign in with the temporary password."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="managed-name">Full name</Label>
              <Input
                id="managed-name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Employee full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-email">Gmail address</Label>
              <Input
                id="managed-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="employee@gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-id">Employee ID</Label>
              <Input
                id="managed-id"
                required
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                placeholder="EMP-0102"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Department Employee</SelectItem>
                  <SelectItem value="agent">MIS Agent</SelectItem>
                  <SelectItem value="admin">MIS Head / Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={role === "employee" ? department : "MIS"}
                disabled={role !== "employee"}
                onValueChange={setDepartment}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter((item) => item.name !== "MIS")
                    .map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  <SelectItem value="MIS">MIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-password">Temporary password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="managed-password"
                  type={showTemporaryPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={temporaryPassword}
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                  className="px-9"
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowTemporaryPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={
                    showTemporaryPassword ? "Hide temporary password" : "Show temporary password"
                  }
                >
                  {showTemporaryPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {previewOnly ? "Add demo user" : "Create confirmed account"}
            </Button>
          </div>
        </form>
      )}

      {resetUser && (
        <form
          onSubmit={submitPasswordReset}
          className="mb-6 rounded-2xl border border-warning/35 bg-warning/10 p-5"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="reset-password">
                New temporary password for {resetUser.fullName ?? resetUser.email}
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  className="px-9"
                  placeholder="Minimum 8 characters"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setResetUser(null);
                  setResetPassword("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset password
              </Button>
            </div>
          </div>
        </form>
      )}

      {emailUser && (
        <form
          onSubmit={submitEmailChange}
          className="mb-6 rounded-2xl border border-primary/35 bg-primary/5 p-5"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="w-full max-w-md space-y-2">
              <Label htmlFor="new-email">
                New Gmail address for {emailUser.fullName ?? emailUser.email}
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="pl-9"
                  placeholder="name@gmail.com"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                They will sign in with this email going forward; the account stays confirmed.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEmailUser(null);
                  setNewEmail("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={changingEmail}>
                {changingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update email
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or employee ID"
            className="pl-9"
          />
        </div>
        <Select
          value={departmentFilter}
          onValueChange={(value) => setDepartmentFilter(value as DepartmentFilter)}
        >
          <SelectTrigger>
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments ({users.length})</SelectItem>
            {departments.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.name} ({departmentCounts[item.name] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
          <SelectTrigger>
            <UsersRound className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">MIS Heads</SelectItem>
            <SelectItem value="agent">MIS Agents</SelectItem>
            <SelectItem value="employee">Employees</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No accounts match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-5 py-3">Last sign in</th>
                  <th className="px-5 py-3">Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition hover:bg-muted/25">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{user.fullName ?? "Name not set"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{user.employeeId ?? "Not set"}</td>
                    <td className="px-4 py-4">
                      {user.role === "employee" ? (
                        <Select
                          value={user.department ?? ""}
                          onValueChange={(value) => void updateDepartment(user, value)}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments
                              .filter((item) => item.name !== "MIS")
                              .map((item) => (
                                <SelectItem key={item.name} value={item.name}>
                                  {item.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-medium">MIS</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Select
                        value={user.role}
                        onValueChange={(value) => void updateRole(user, value as AppRole)}
                      >
                        <SelectTrigger
                          className={`h-8 w-36 border text-xs font-semibold capitalize ${roleStyles[user.role]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">MIS Head</SelectItem>
                          <SelectItem value="agent">MIS Agent</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          user.confirmed
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {user.confirmed ? "Ready" : "Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEmailUser(user);
                            setNewEmail(user.email);
                          }}
                        >
                          <Mail className="mr-2 h-3.5 w-3.5" /> Email
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setResetUser(user);
                            setResetPassword("");
                            setShowResetPassword(false);
                          }}
                        >
                          <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

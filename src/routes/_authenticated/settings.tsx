import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Layers3, Loader2, Plus, Power, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getCurrentUserContext } from "@/lib/current-user";
import { FALLBACK_DEPARTMENTS } from "@/lib/departments";
import { isPreviewMode } from "@/lib/preview-auth";
import { MIS_TICKET_CATEGORIES } from "@/lib/ticket-categories";

type CategoryRow = Database["public"]["Tables"]["issue_categories"]["Row"];
type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Master Setup — MIS Support Hub" },
      {
        name: "description",
        content: "Manage support categories and company departments.",
      },
    ],
  }),
  component: MasterSetupPage,
});

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function previewCategories(): CategoryRow[] {
  const now = new Date().toISOString();
  return MIS_TICKET_CATEGORIES.map((item, index) => ({
    id: `preview-category-${index}`,
    slug: item.value,
    name: item.label,
    description: item.hint,
    group_name: item.group,
    active: true,
    sort_order: (index + 1) * 10,
    created_by: null,
    created_at: now,
    updated_at: now,
  }));
}

function previewDepartments(): DepartmentRow[] {
  const now = new Date().toISOString();
  return FALLBACK_DEPARTMENTS.map((item, index) => ({
    id: `preview-department-${index}`,
    name: item.name,
    description: item.description,
    active: true,
    sort_order: (index + 1) * 10,
    created_by: null,
    created_at: now,
    updated_at: now,
  }));
}

function MasterSetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"category" | "department" | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryGroup, setCategoryGroup] = useState("Odoo & Textile");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");

  const loadSetup = async () => {
    setLoading(true);
    if (isPreviewMode()) {
      setCategories(previewCategories());
      setDepartments(previewDepartments());
      setLoading(false);
      return;
    }
    const [
      { data: categoryRows, error: categoryError },
      { data: departmentRows, error: departmentError },
    ] = await Promise.all([
      supabase.from("issue_categories").select("*").order("sort_order").order("name"),
      supabase.from("departments").select("*").order("sort_order").order("name"),
    ]);
    if (categoryError || departmentError) {
      toast.error(
        categoryError?.message ?? departmentError?.message ?? "Master setup could not be loaded.",
      );
    }
    setCategories(categoryRows ?? []);
    setDepartments(departmentRows ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void getCurrentUserContext().then((context) => {
      if (context?.role !== "admin") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      void loadSetup();
    });
  }, [navigate]);

  const categoryGroups = useMemo(
    () =>
      Object.entries(
        categories.reduce<Record<string, CategoryRow[]>>((groups, item) => {
          (groups[item.group_name] ??= []).push(item);
          return groups;
        }, {}),
      ),
    [categories],
  );

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = categoryName.trim();
    const slug = createSlug(name);
    if (name.length < 2 || !slug) {
      toast.error("Enter a valid category name.");
      return;
    }
    if (
      categories.some(
        (item) => item.slug === slug || item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast.error("This category already exists.");
      return;
    }
    setSaving("category");
    const next: CategoryRow = {
      id: crypto.randomUUID(),
      slug,
      name,
      description: categoryDescription.trim() || null,
      group_name: categoryGroup,
      active: true,
      sort_order: Math.max(0, ...categories.map((item) => item.sort_order)) + 10,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      if (isPreviewMode()) {
        setCategories((current) => [...current, next]);
      } else {
        const { error } = await supabase.from("issue_categories").insert({
          slug: next.slug,
          name: next.name,
          description: next.description,
          group_name: next.group_name,
          sort_order: next.sort_order,
        });
        if (error) throw error;
        await loadSetup();
      }
      setCategoryName("");
      setCategoryDescription("");
      toast.success(`${name} category added.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category could not be added.");
    } finally {
      setSaving(null);
    }
  };

  const addDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = departmentName.trim();
    if (name.length < 2) {
      toast.error("Enter a valid department name.");
      return;
    }
    if (departments.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      toast.error("This department already exists.");
      return;
    }
    setSaving("department");
    const next: DepartmentRow = {
      id: crypto.randomUUID(),
      name,
      description: departmentDescription.trim() || null,
      active: true,
      sort_order: Math.max(0, ...departments.map((item) => item.sort_order)) + 10,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      if (isPreviewMode()) {
        setDepartments((current) => [...current, next]);
      } else {
        const { error } = await supabase.from("departments").insert({
          name: next.name,
          description: next.description,
          sort_order: next.sort_order,
        });
        if (error) throw error;
        await loadSetup();
      }
      setDepartmentName("");
      setDepartmentDescription("");
      toast.success(`${name} department added.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Department could not be added.");
    } finally {
      setSaving(null);
    }
  };

  const toggleCategory = async (item: CategoryRow) => {
    const active = !item.active;
    if (isPreviewMode()) {
      setCategories((current) =>
        current.map((category) => (category.id === item.id ? { ...category, active } : category)),
      );
    } else {
      const { error } = await supabase
        .from("issue_categories")
        .update({ active })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await loadSetup();
    }
    toast.success(`${item.name} ${active ? "activated" : "deactivated"}.`);
  };

  const toggleDepartment = async (item: DepartmentRow) => {
    if (item.name === "MIS" && item.active) {
      toast.error("The core MIS department cannot be deactivated.");
      return;
    }
    const active = !item.active;
    if (isPreviewMode()) {
      setDepartments((current) =>
        current.map((department) =>
          department.id === item.id ? { ...department, active } : department,
        ),
      );
    } else {
      const { error } = await supabase.from("departments").update({ active }).eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await loadSetup();
    }
    toast.success(`${item.name} ${active ? "activated" : "deactivated"}.`);
  };

  return (
    <AppShell>
      <div className="mb-7">
        <p className="text-sm font-semibold text-primary">Admin control</p>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
          <Settings2 className="h-8 w-8 text-primary" /> Master Setup
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Manage the departments and issue categories used throughout MISphere. Changes become
          available in ticket and user forms immediately.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Controlled administration
        </p>
        <p className="mt-1 text-muted-foreground">
          The MIS Head can manage categories, departments and user accounts. Ticket workflow,
          admin-only closure and security roles remain protected system rules.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 p-5">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Layers3 className="h-5 w-5 text-primary" /> Issue Categories
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {categories.filter((item) => item.active).length} active of {categories.length}
              </p>
            </div>
            <form
              onSubmit={addCategory}
              className="grid gap-4 border-b border-border/60 p-5 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="category-name">Category name</Label>
                <Input
                  id="category-name"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="e.g. Odoo Payroll"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category group</Label>
                <Select value={categoryGroup} onValueChange={setCategoryGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Odoo & Textile">Odoo & Textile</SelectItem>
                    <SelectItem value="General MIS">General MIS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="category-description">Short guidance</Label>
                <Textarea
                  id="category-description"
                  value={categoryDescription}
                  onChange={(event) => setCategoryDescription(event.target.value)}
                  placeholder="Explain which issues belong in this category"
                  maxLength={240}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving !== null}>
                  {saving === "category" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add Category
                </Button>
              </div>
            </form>
            <div className="space-y-5 p-5">
              {categoryGroups.map(([group, items]) => (
                <div key={group}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {group} · {items.length}
                  </h3>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{item.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                            >
                              {item.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.description || item.slug}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleCategory(item)}
                        >
                          <Power className="mr-2 h-3.5 w-3.5" />
                          {item.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="h-fit rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 p-5">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Building2 className="h-5 w-5 text-primary" /> Departments
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {departments.filter((item) => item.active).length} active
              </p>
            </div>
            <form onSubmit={addDepartment} className="space-y-4 border-b border-border/60 p-5">
              <div className="space-y-2">
                <Label htmlFor="department-name">Department name</Label>
                <Input
                  id="department-name"
                  value={departmentName}
                  onChange={(event) => setDepartmentName(event.target.value)}
                  placeholder="e.g. Human Resources"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">Description</Label>
                <Textarea
                  id="department-description"
                  value={departmentDescription}
                  onChange={(event) => setDepartmentDescription(event.target.value)}
                  placeholder="Department responsibilities"
                  maxLength={240}
                />
              </div>
              <Button type="submit" disabled={saving !== null}>
                {saving === "department" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Department
              </Button>
            </form>
            <div className="divide-y divide-border/60">
              {departments.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {item.description || "No description"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void toggleDepartment(item)}
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span className="sr-only">
                      {item.active ? "Disable" : "Enable"} {item.name}
                    </span>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

import { supabase } from "@/integrations/supabase/client";

export const EMPLOYEE_DEPARTMENTS = [
  "Accounts",
  "Inventory",
  "Quality",
  "Production",
  "Warehouse",
] as const;

export const MIS_DEPARTMENT = "MIS";

export type EmployeeDepartment = string;

export type DepartmentOption = {
  id?: string;
  name: string;
  description: string;
  active?: boolean;
};

export const FALLBACK_DEPARTMENTS: DepartmentOption[] = [
  { name: MIS_DEPARTMENT, description: "Management Information Systems and Odoo development team" },
  { name: "Accounts", description: "Finance, accounts and taxation" },
  { name: "Inventory", description: "Inventory control and stock operations" },
  { name: "Quality", description: "Quality assurance and quality control" },
  { name: "Production", description: "Textile mill production operations" },
  { name: "Warehouse", description: "Warehousing, dispatch and material handling" },
];

export async function loadDepartments(includeInactive = false) {
  let query = supabase
    .from("departments")
    .select("id, name, description, active")
    .order("sort_order")
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error || !data?.length) return FALLBACK_DEPARTMENTS;
  return data.map((department): DepartmentOption => ({
    id: department.id,
    name: department.name,
    description: department.description ?? "",
    active: department.active,
  }));
}

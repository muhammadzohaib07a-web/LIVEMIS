import { supabase } from "@/integrations/supabase/client";

export type TicketCategory = string;

export type TicketCategoryOption = {
  value: TicketCategory;
  label: string;
  hint: string;
  group: string;
  active?: boolean;
};

export const MIS_TICKET_CATEGORIES: TicketCategoryOption[] = [
  {
    value: "hardware",
    label: "Computer / Laptop",
    hint: "PC, laptop, monitor, keyboard, mouse",
    group: "General MIS",
  },
  {
    value: "printer",
    label: "Printer / Scanner",
    hint: "Printing, labels, scanning",
    group: "General MIS",
  },
  {
    value: "software",
    label: "Software",
    hint: "Windows, Office and installed apps",
    group: "General MIS",
  },
  { value: "network", label: "Network / Wi-Fi", hint: "Internet, LAN, VPN", group: "General MIS" },
  {
    value: "email",
    label: "Email / Outlook",
    hint: "Mailbox and email delivery",
    group: "General MIS",
  },
  {
    value: "access",
    label: "User Access",
    hint: "Accounts, passwords and permissions",
    group: "General MIS",
  },
  {
    value: "odoo",
    label: "Odoo General Support",
    hint: "General Odoo issue or request",
    group: "General MIS",
  },
  { value: "erp", label: "Other ERP", hint: "Non-Odoo business systems", group: "General MIS" },
  {
    value: "server",
    label: "Server",
    hint: "Server availability and services",
    group: "General MIS",
  },
  { value: "backup", label: "Backup", hint: "Backup, restore and recovery", group: "General MIS" },
  { value: "cctv", label: "CCTV", hint: "Cameras, NVR and monitoring", group: "General MIS" },
  {
    value: "attendance",
    label: "Attendance System",
    hint: "Biometric device and attendance sync",
    group: "General MIS",
  },
  {
    value: "other",
    label: "Other MIS Issue",
    hint: "Any other MIS-related request",
    group: "General MIS",
  },
  {
    value: "odoo-functional-support",
    label: "Odoo Functional Support",
    hint: "Configuration and functional guidance",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-custom-development",
    label: "Odoo Custom Development",
    hint: "New modules, fields, screens and logic",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-bug-fix",
    label: "Odoo Bug Fix",
    hint: "Errors and unexpected Odoo behavior",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-report-development",
    label: "Odoo Report Development",
    hint: "QWeb, PDF, Excel and management reports",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-workflow-approval",
    label: "Odoo Workflow / Approval",
    hint: "Business workflows and approvals",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-user-access-security",
    label: "Odoo User Access / Security",
    hint: "Roles, record rules and access rights",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-api-integration",
    label: "Odoo API / Integration",
    hint: "Third-party software and device integrations",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-performance",
    label: "Odoo Performance",
    hint: "Slow screens, queries and jobs",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-inventory",
    label: "Odoo Inventory",
    hint: "Stock, valuation, lots and replenishment",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-manufacturing",
    label: "Odoo Manufacturing",
    hint: "MRP, work orders and BOMs",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-quality",
    label: "Odoo Quality",
    hint: "Quality checks, alerts and inspections",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-purchase",
    label: "Odoo Purchase",
    hint: "RFQs, purchase orders and vendors",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-sales",
    label: "Odoo Sales",
    hint: "Quotations, sales orders and customers",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-accounting",
    label: "Odoo Accounting",
    hint: "Invoices, payments, journals and reports",
    group: "Odoo & Textile",
  },
  {
    value: "odoo-warehouse",
    label: "Odoo Warehouse",
    hint: "Receipts, deliveries and transfers",
    group: "Odoo & Textile",
  },
  {
    value: "textile-weaving",
    label: "Textile Weaving",
    hint: "Loom planning, production and efficiency",
    group: "Odoo & Textile",
  },
  {
    value: "textile-dyeing",
    label: "Textile Dyeing",
    hint: "Dyeing batches, recipes and processes",
    group: "Odoo & Textile",
  },
  {
    value: "textile-finishing",
    label: "Textile Finishing",
    hint: "Finishing, inspection and dispatch readiness",
    group: "Odoo & Textile",
  },
  {
    value: "textile-planning",
    label: "Textile Production Planning",
    hint: "Demand, capacity and material planning",
    group: "Odoo & Textile",
  },
  {
    value: "textile-costing",
    label: "Textile Costing",
    hint: "Material, process and order costing",
    group: "Odoo & Textile",
  },
];

export async function loadTicketCategories(includeInactive = false) {
  let query = supabase
    .from("issue_categories")
    .select("slug, name, description, group_name, active")
    .order("sort_order")
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error || !data?.length) return MIS_TICKET_CATEGORIES;
  return data.map((item): TicketCategoryOption => ({
    value: item.slug,
    label: item.name,
    hint: item.description ?? "",
    group: item.group_name,
    active: item.active,
  }));
}

export function getCategoryLabel(
  value: TicketCategory,
  categories: TicketCategoryOption[] = MIS_TICKET_CATEGORIES,
) {
  return (
    categories.find((item) => item.value === value)?.label ??
    value
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

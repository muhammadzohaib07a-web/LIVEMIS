import type { Database } from "@/integrations/supabase/types";

export type TicketCategory = Database["public"]["Enums"]["ticket_category"];

export const MIS_TICKET_CATEGORIES: {
  value: TicketCategory;
  label: string;
  hint: string;
}[] = [
  {
    value: "hardware",
    label: "Computer / Laptop",
    hint: "PC, laptop, monitor, keyboard, mouse",
  },
  { value: "printer", label: "Printer / Scanner", hint: "Printing, labels, scanning" },
  { value: "software", label: "Software", hint: "Windows, Office and installed apps" },
  { value: "network", label: "Network / Wi-Fi", hint: "Internet, LAN, VPN" },
  { value: "email", label: "Email / Outlook", hint: "Mailbox and email delivery" },
  { value: "access", label: "User Access", hint: "Accounts, passwords and permissions" },
  {
    value: "odoo",
    label: "Odoo Development / Support",
    hint: "Odoo bugs, reports, modules, workflows and customization",
  },
  { value: "erp", label: "Other ERP", hint: "Non-Odoo business systems" },
  { value: "server", label: "Server", hint: "Server availability and services" },
  { value: "backup", label: "Backup", hint: "Backup, restore and recovery" },
  { value: "cctv", label: "CCTV", hint: "Cameras, NVR and monitoring" },
  {
    value: "attendance",
    label: "Attendance System",
    hint: "Biometric device and attendance sync",
  },
  { value: "other", label: "Other MIS Issue", hint: "Any other MIS-related request" },
];

export function getCategoryLabel(value: TicketCategory) {
  return MIS_TICKET_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

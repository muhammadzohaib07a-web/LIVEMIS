import type { AppRole } from "./current-user";

export type MentionOption = { tag: string; label: string };

// Ticket chat is only ever 2-3 people (employee, one agent, the MIS Head), so
// mentions are a small fixed set of role tags rather than a searchable user
// directory. The backend trigger (notify_on_ticket_message) resolves each tag
// to the real recipients and fires the "you were mentioned" notification.
export function mentionOptionsForRole(role: AppRole, employeeName: string | null): MentionOption[] {
  if (role === "admin") {
    return [{ tag: "@Everyone", label: "Notify everyone on this ticket" }];
  }
  if (role === "agent") {
    return [
      { tag: "@Admin", label: "MIS Head" },
      { tag: "@Employee", label: employeeName ?? "Employee" },
    ];
  }
  return [{ tag: "@Team", label: "MIS Team" }];
}

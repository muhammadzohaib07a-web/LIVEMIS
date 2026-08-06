import type { Database } from "@/integrations/supabase/types";

export type TicketStatus = Database["public"]["Enums"]["ticket_status"];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  answered: "Answered",
  awaiting_feedback: "Awaiting Customer Feedback",
  resolved: "Closed",
  closed: "Closed",
  canceled: "Canceled",
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  answered: "bg-accent/15 text-accent border-accent/30",
  awaiting_feedback: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  closed: "bg-success/15 text-success border-success/30",
  canceled: "bg-destructive/15 text-destructive border-destructive/30",
};

export const MIS_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "canceled"],
  in_progress: ["answered", "canceled"],
  answered: ["awaiting_feedback", "in_progress", "canceled"],
  awaiting_feedback: ["closed", "in_progress", "canceled"],
  resolved: ["closed"],
  closed: [],
  canceled: [],
};

export function normalizedTicketStatus(status: TicketStatus): TicketStatus {
  return status === "resolved" ? "closed" : status;
}

export const STATUS_CHANGE_MESSAGE_PREFIX = "🔄 Status changed";

export function isStatusChangeMessage(body: string): boolean {
  return body.startsWith(STATUS_CHANGE_MESSAGE_PREFIX);
}

export function formatStatusChangeMessage(from: TicketStatus, to: TicketStatus): string {
  return `${STATUS_CHANGE_MESSAGE_PREFIX} from ${TICKET_STATUS_LABELS[from]} to ${TICKET_STATUS_LABELS[to]}`;
}

export const ASSIGNMENT_MESSAGE_PREFIX = "📋 Assigned to";

export function isAssignmentMessage(body: string): boolean {
  return body.startsWith(ASSIGNMENT_MESSAGE_PREFIX);
}

export function formatAssignmentMessage(agentName: string): string {
  return `${ASSIGNMENT_MESSAGE_PREFIX} ${agentName}`;
}

export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

// Target time-to-resolution by priority, measured from ticket creation.
// Drives the "Due in / Overdue by" badge shown on the ticket detail and list pages.
export const SLA_HOURS_BY_PRIORITY: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 96,
};

export function getSlaDueDate(createdAt: string, priority: TicketPriority): Date {
  return new Date(new Date(createdAt).getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export type SlaTone = "success" | "warning" | "destructive" | "muted";

export type SlaState = {
  dueAt: Date;
  tone: SlaTone;
  label: string;
};

export const SLA_TONE_STYLES: Record<SlaTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-muted/40 text-muted-foreground border-border",
};

export function getSlaState(ticket: {
  created_at: string;
  priority: TicketPriority;
  status: TicketStatus;
  closed_at: string | null;
  updated_at: string;
}): SlaState | null {
  if (ticket.status === "canceled") return null;

  const totalMs = SLA_HOURS_BY_PRIORITY[ticket.priority] * 60 * 60 * 1000;
  const dueAt = getSlaDueDate(ticket.created_at, ticket.priority);

  if (normalizedTicketStatus(ticket.status) === "closed") {
    const closedAt = new Date(ticket.closed_at ?? ticket.updated_at).getTime();
    const lateMs = closedAt - dueAt.getTime();
    return lateMs > 0
      ? { dueAt, tone: "warning", label: `Closed ${formatDuration(lateMs)} late` }
      : { dueAt, tone: "success", label: "Closed on time" };
  }

  const remaining = dueAt.getTime() - Date.now();
  if (remaining <= 0) {
    return { dueAt, tone: "destructive", label: `Overdue by ${formatDuration(-remaining)}` };
  }
  return {
    dueAt,
    tone: remaining < totalMs * 0.25 ? "warning" : "muted",
    label: `Due in ${formatDuration(remaining)}`,
  };
}

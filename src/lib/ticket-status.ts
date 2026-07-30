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

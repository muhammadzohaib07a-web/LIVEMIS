import type { Database } from "@/integrations/supabase/types";

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type Message = Database["public"]["Tables"]["ticket_messages"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"];

const now = new Date();

export const previewTickets: Ticket[] = [
  {
    id: "demo-ticket-1",
    ticket_no: "T-100241",
    user_id: "preview-employee",
    assignee_id: null,
    title: "Odoo production order report needs correction",
    description:
      "The Odoo manufacturing order PDF is missing the production batch and machine fields.",
    category: "odoo",
    priority: "urgent",
    status: "open",
    attachments: [],
    parent_ticket_id: null,
    follow_up_reason: null,
    created_at: new Date(now.getTime() - 25 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 25 * 60_000).toISOString(),
  },
  {
    id: "demo-ticket-2",
    ticket_no: "T-100238",
    user_id: "preview-employee-quality",
    assignee_id: "preview-agent-1",
    title: "Quality lab printer is offline",
    description:
      "The label printer in the quality lab is powered on but Windows keeps showing it as offline.",
    category: "printer",
    priority: "high",
    status: "in_progress",
    attachments: [],
    parent_ticket_id: null,
    follow_up_reason: null,
    created_at: new Date(now.getTime() - 3 * 60 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 35 * 60_000).toISOString(),
  },
  {
    id: "demo-ticket-3",
    ticket_no: "T-100229",
    user_id: "preview-employee-accounts",
    assignee_id: "preview-agent-2",
    title: "Accounts shared folder access required",
    description: "A new accounts employee needs read access to the monthly closing shared folder.",
    category: "access",
    priority: "medium",
    status: "closed",
    attachments: [],
    parent_ticket_id: null,
    follow_up_reason: null,
    created_at: new Date(now.getTime() - 26 * 60 * 60_000).toISOString(),
    updated_at: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
  },
];

export const previewRequesters = {
  "preview-employee": {
    full_name: "Attique Shb",
    department: "Production",
    email: "ali.raza@mill.local",
  },
  "preview-employee-quality": {
    full_name: "Sana Ahmed",
    department: "Quality",
    email: "sana.ahmed@mill.local",
  },
  "preview-employee-accounts": {
    full_name: "Usman Khan",
    department: "Accounts",
    email: "usman.khan@mill.local",
  },
} as const;

export const previewMessages: Record<string, Message[]> = {
  "demo-ticket-2": [
    {
      id: "demo-message-1",
      ticket_id: "demo-ticket-2",
      sender_id: "preview-employee-quality",
      body: "The printer stopped working after this morning's Windows update.",
      created_at: new Date(now.getTime() - 2 * 60 * 60_000).toISOString(),
    },
    {
      id: "demo-message-2",
      ticket_id: "demo-ticket-2",
      sender_id: "preview-agent-1",
      body: "MIS is checking the print spooler and network connection now.",
      created_at: new Date(now.getTime() - 35 * 60_000).toISOString(),
    },
  ],
};

export const previewAgents = [
  {
    id: "preview-agent-1",
    full_name: "Muhammad Zohaib",
    email: "zohaib.mis@mill.local",
    assigned_count: 1,
  },
  {
    id: "preview-agent-2",
    full_name: "Ahmed Raza",
    email: "ahmed.mis@mill.local",
    assigned_count: 1,
  },
];

export const PREVIEW_CHAT_STORAGE_KEY = "mis-support-preview-chat-messages";
export const PREVIEW_TICKET_STORAGE_KEY = "mis-support-preview-ticket-updates";
export const PREVIEW_CREATED_TICKETS_KEY = "mis-support-preview-created-tickets";
export const PREVIEW_NOTIFICATIONS_KEY = "mis-support-preview-notifications";

type StoredPreviewMessages = Record<string, Message[]>;
type StoredPreviewTickets = Record<string, Partial<Ticket>>;

function readPreviewNotifications(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const notifications = JSON.parse(localStorage.getItem(PREVIEW_NOTIFICATIONS_KEY) ?? "[]");
    return Array.isArray(notifications) ? notifications : [];
  } catch {
    return [];
  }
}

export function getPreviewNotifications(userId: string) {
  return readPreviewNotifications()
    .filter((notification) => notification.user_id === userId)
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
}

export function storePreviewNotification(notification: Notification) {
  const notifications = readPreviewNotifications();
  if (notifications.some((candidate) => candidate.id === notification.id)) return;
  localStorage.setItem(PREVIEW_NOTIFICATIONS_KEY, JSON.stringify([notification, ...notifications]));
}

export function markPreviewNotificationsRead(userId: string, notificationIds?: string[]) {
  const selectedIds = notificationIds ? new Set(notificationIds) : null;
  const notifications = readPreviewNotifications().map((notification) =>
    notification.user_id === userId && (!selectedIds || selectedIds.has(notification.id))
      ? { ...notification, read: true }
      : notification,
  );
  localStorage.setItem(PREVIEW_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function readCreatedTickets(): Ticket[] {
  if (typeof window === "undefined") return [];
  try {
    const tickets = JSON.parse(localStorage.getItem(PREVIEW_CREATED_TICKETS_KEY) ?? "[]");
    return Array.isArray(tickets) ? tickets : [];
  } catch {
    return [];
  }
}

function readStoredMessages(): StoredPreviewMessages {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_CHAT_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getPreviewMessages(ticketId: string) {
  const initial = previewMessages[ticketId] ?? [];
  const stored = readStoredMessages()[ticketId] ?? [];
  return [...initial, ...stored]
    .filter(
      (message, index, all) => all.findIndex((candidate) => candidate.id === message.id) === index,
    )
    .sort(
      (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );
}

export function storePreviewMessage(message: Message) {
  const allMessages = readStoredMessages();
  const ticketMessages = allMessages[message.ticket_id] ?? [];
  if (!ticketMessages.some((candidate) => candidate.id === message.id)) {
    allMessages[message.ticket_id] = [...ticketMessages, message];
    localStorage.setItem(PREVIEW_CHAT_STORAGE_KEY, JSON.stringify(allMessages));
  }
}

function readStoredTicketUpdates(): StoredPreviewTickets {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_TICKET_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getPreviewTicket(ticketId: string) {
  const ticket = [...previewTickets, ...readCreatedTickets()].find(
    (candidate) => candidate.id === ticketId,
  );
  if (!ticket) return null;
  return { ...ticket, ...(readStoredTicketUpdates()[ticketId] ?? {}) };
}

export function getCurrentPreviewTickets() {
  const updates = readStoredTicketUpdates();
  return [...previewTickets, ...readCreatedTickets()]
    .map((ticket) => ({ ...ticket, ...(updates[ticket.id] ?? {}) }))
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
}

export function storePreviewTicket(ticket: Ticket) {
  const tickets = readCreatedTickets();
  const existingIndex = tickets.findIndex((candidate) => candidate.id === ticket.id);
  if (existingIndex >= 0) {
    tickets[existingIndex] = ticket;
  } else {
    tickets.push(ticket);
  }
  localStorage.setItem(PREVIEW_CREATED_TICKETS_KEY, JSON.stringify(tickets));
}

export function storePreviewTicketUpdate(ticketId: string, update: Partial<Ticket>) {
  const updates = readStoredTicketUpdates();
  updates[ticketId] = {
    ...(updates[ticketId] ?? {}),
    ...update,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(PREVIEW_TICKET_STORAGE_KEY, JSON.stringify(updates));
}

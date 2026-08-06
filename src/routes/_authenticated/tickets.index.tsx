import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PlusCircle, Search, Loader2, ChevronRight, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentUserContext, isMisStaff, type AppRole } from "@/lib/current-user";
import { getPreviewRole, isPreviewMode } from "@/lib/preview-auth";
import {
  getCurrentPreviewTickets,
  PREVIEW_CREATED_TICKETS_KEY,
  PREVIEW_TICKET_STORAGE_KEY,
  previewRequesters,
} from "@/lib/preview-data";
import {
  getCategoryLabel,
  loadTicketCategories,
  MIS_TICKET_CATEGORIES,
  type TicketCategory,
  type TicketCategoryOption,
} from "@/lib/ticket-categories";
import {
  getSlaState,
  normalizedTicketStatus,
  SLA_TONE_STYLES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
} from "@/lib/ticket-status";
import { APP_TITLE } from "@/lib/app-meta";

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type Status = Database["public"]["Enums"]["ticket_status"] | "all";
type QueueFilter = "all" | "unassigned" | "assigned";
type CategoryFilter = "all" | TicketCategory;
type Requester = { full_name: string | null; department: string | null; email: string | null };

export const Route = createFileRoute("/_authenticated/tickets/")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      { name: "description", content: "Track all your MIS support tickets." },
      { property: "og:title", content: "My Tickets — MIS Support Hub" },
      { property: "og:description", content: "All your IT tickets in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketsList,
});

const statusStyles = TICKET_STATUS_STYLES;
const statusLabel = TICKET_STATUS_LABELS;
const priorityDot: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-primary",
  high: "bg-warning",
  urgent: "bg-destructive",
};

function TicketsList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [categories, setCategories] = useState<TicketCategoryOption[]>(MIS_TICKET_CATEGORIES);
  const [role, setRole] = useState<AppRole>("employee");
  const [me, setMe] = useState<string | null>(null);
  const [requesters, setRequesters] = useState<Record<string, Requester>>({});

  useEffect(() => {
    let previewTicketChannel: BroadcastChannel | null = null;
    let ticketChannel: ReturnType<typeof supabase.channel> | null = null;
    let syncPreviewTickets: ((event: StorageEvent) => void) | null = null;

    if (isPreviewMode()) {
      const canSeePreviewTicket = (ticket: Ticket) => {
        const previewRole = getPreviewRole();
        if (previewRole === "admin") return true;
        if (previewRole === "agent") return ticket.assignee_id === "preview-agent-1";
        return ticket.user_id === "preview-employee";
      };
      const refreshPreviewTickets = () => {
        setTickets(getCurrentPreviewTickets().filter(canSeePreviewTicket));
      };
      previewTicketChannel = new BroadcastChannel("mis-support-preview-ticket-updates");
      previewTicketChannel.onmessage = (event: MessageEvent<Partial<Ticket> & { id: string }>) => {
        setTickets((current) => {
          const existing = current.find((ticket) => ticket.id === event.data.id);
          if (existing) {
            const updated = { ...existing, ...event.data };
            return canSeePreviewTicket(updated)
              ? current.map((ticket) => (ticket.id === updated.id ? updated : ticket))
              : current.filter((ticket) => ticket.id !== updated.id);
          }
          const submitted = event.data as Ticket;
          return submitted.title && submitted.user_id && canSeePreviewTicket(submitted)
            ? [submitted, ...current]
            : current;
        });
      };
      syncPreviewTickets = (event) => {
        if (event.key === PREVIEW_CREATED_TICKETS_KEY || event.key === PREVIEW_TICKET_STORAGE_KEY) {
          refreshPreviewTickets();
        }
      };
      window.addEventListener("storage", syncPreviewTickets);
    } else {
      ticketChannel = supabase
        .channel("visible-ticket-list")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
          if (payload.eventType === "INSERT") {
            const inserted = payload.new as Ticket;
            setTickets((current) =>
              current.some((ticket) => ticket.id === inserted.id)
                ? current
                : [inserted, ...current],
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Ticket;
            setTickets((current) =>
              current.map((ticket) => (ticket.id === updated.id ? updated : ticket)),
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as Pick<Ticket, "id">;
            setTickets((current) => current.filter((ticket) => ticket.id !== deleted.id));
          }
        })
        .subscribe();
    }

    (async () => {
      setLoading(true);
      if (!isPreviewMode()) {
        void loadTicketCategories().then(setCategories);
      }
      const context = await getCurrentUserContext();
      if (!context) {
        setLoading(false);
        return;
      }
      setRole(context.role);
      setMe(context.id);
      if (isPreviewMode()) {
        const previewTickets = getCurrentPreviewTickets();
        setTickets(
          context.role === "admin"
            ? previewTickets
            : context.role === "agent"
              ? previewTickets.filter((ticket) => ticket.assignee_id === context.id)
              : previewTickets.filter((ticket) => ticket.user_id === context.id),
        );
        setRequesters(previewRequesters);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      setTickets(rows);
      if (isMisStaff(context.role) && rows.length > 0) {
        const userIds = [...new Set(rows.map((ticket) => ticket.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, department, email")
          .in("id", userIds);
        setRequesters(
          Object.fromEntries(
            (profiles ?? []).map((profile) => [
              profile.id,
              {
                full_name: profile.full_name,
                department: profile.department,
                email: profile.email,
              },
            ]),
          ),
        );
      }
      setLoading(false);
    })();

    return () => {
      if (syncPreviewTickets) window.removeEventListener("storage", syncPreviewTickets);
      previewTicketChannel?.close();
      if (ticketChannel) supabase.removeChannel(ticketChannel);
    };
  }, []);

  const filtered = tickets.filter((t) => {
    if (status !== "all" && normalizedTicketStatus(t.status) !== status) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (queueFilter === "unassigned" && t.assignee_id) return false;
    if (queueFilter === "assigned" && !t.assignee_id) return false;
    if (q && !`${t.ticket_no} ${t.title}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {role === "admin"
              ? "Assign requests from all departments to MIS agents"
              : role === "agent"
                ? "Tickets assigned to you by the MIS Head"
                : "Your requests to MIS"}
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {role === "admin"
              ? "MIS Head Queue"
              : role === "agent"
                ? "My Assigned Tickets"
                : "My Tickets"}
          </h1>
        </div>
        {!isMisStaff(role) && (
          <Link
            to="/report"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" /> New Ticket
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID or title…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="awaiting_feedback">Awaiting Customer Feedback</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All MIS categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {role === "admin" && (
          <Select value={queueFilter} onValueChange={(v) => setQueueFilter(v as QueueFilter)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MIS tickets</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="assigned">Assigned to agents</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 backdrop-blur">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No tickets match your filters.</p>
            {role === "employee" && (
              <Link
                to="/report"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <PlusCircle className="h-4 w-4" /> Report a problem
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((t) => {
              const slaState = getSlaState(t);
              return (
              <li key={t.id}>
                <Link
                  to="/tickets/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_no}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusStyles[t.status]}`}
                      >
                        {statusLabel[t.status]}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[t.priority]}`} />
                        {t.priority}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        · {getCategoryLabel(t.category, categories)}
                      </span>
                      {slaState && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SLA_TONE_STYLES[slaState.tone]}`}
                        >
                          {slaState.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isMisStaff(role) && (
                        <>
                          {requesters[t.user_id]?.full_name ??
                            requesters[t.user_id]?.email ??
                            "Employee"}
                          {" · "}
                          {requesters[t.user_id]?.department ?? "Department not set"}
                          {" · "}
                        </>
                      )}
                      {t.assignee_id
                        ? t.assignee_id === me
                          ? "Assigned to you · "
                          : "Assigned · "
                        : isMisStaff(role)
                          ? "Unassigned · "
                          : ""}
                      {`Opened ${new Date(t.created_at).toLocaleString()}`}
                      {normalizedTicketStatus(t.status) === "closed" &&
                        ` · Closed ${new Date(t.closed_at ?? t.updated_at).toLocaleString()}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

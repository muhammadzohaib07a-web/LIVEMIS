import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Ticket,
  MessageSquare,
  BookOpen,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Sparkles,
  BellRing,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { isPreviewMode } from "@/lib/preview-auth";
import { getCurrentUserContext, isMisStaff, type AppRole } from "@/lib/current-user";
import {
  getCurrentPreviewTickets,
  getPreviewNotifications,
  PREVIEW_CREATED_TICKETS_KEY,
  PREVIEW_NOTIFICATIONS_KEY,
  PREVIEW_TICKET_STORAGE_KEY,
} from "@/lib/preview-data";
import {
  normalizedTicketStatus,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
} from "@/lib/ticket-status";
import { APP_TITLE } from "@/lib/app-meta";
import { sendFeedbackReminders } from "@/lib/feedback-reminders";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type Requester = { full_name: string | null; email: string | null; department: string | null };

function isAssignmentNotification(notification: Pick<NotificationRow, "title" | "read">) {
  return !notification.read && notification.title.toLowerCase().includes("assigned to you");
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      {
        name: "description",
        content:
          "Your MIS Support Hub dashboard: report issues, track tickets, and chat with the IT team.",
      },
      { property: "og:title", content: "Employee Dashboard — MIS Support Hub" },
      { property: "og:description", content: "Track your internal IT tickets in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type Profile = {
  full_name: string | null;
  employee_id: string | null;
  department: string | null;
  email: string | null;
};

const statusStyles = TICKET_STATUS_STYLES;
const statusLabel = TICKET_STATUS_LABELS;

function ticketsVisibleTo(role: AppRole, userId: string, tickets: TicketRow[]) {
  if (role === "admin") return tickets;
  if (role === "agent") return tickets.filter((ticket) => ticket.assignee_id === userId);
  return tickets.filter((ticket) => ticket.user_id === userId);
}

function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [role, setRole] = useState<AppRole>("employee");
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [newAssignments, setNewAssignments] = useState<NotificationRow[]>([]);
  const [requesters, setRequesters] = useState<Record<string, Requester>>({});

  const dismissAssignment = (notificationId: string) => {
    setNewAssignments((current) => current.filter((n) => n.id !== notificationId));
    if (isPreviewMode()) return;
    void supabase.from("notifications").update({ read: true }).eq("id", notificationId);
  };

  useEffect(() => {
    let ticketChannel: ReturnType<typeof supabase.channel> | null = null;
    let notificationChannel: ReturnType<typeof supabase.channel> | null = null;
    let previewChannel: BroadcastChannel | null = null;
    let previewNotificationChannel: BroadcastChannel | null = null;
    let storageListener: ((event: StorageEvent) => void) | null = null;
    let active = true;

    (async () => {
      const context = await getCurrentUserContext();
      if (!context || !active) {
        setLoadingTickets(false);
        return;
      }
      setRole(context.role);
      setProfile({
        full_name: context.fullName,
        employee_id: isPreviewMode() ? "DEMO-001" : null,
        department: context.department,
        email: context.email,
      });
      if (isPreviewMode()) {
        const refreshPreview = () => {
          setTickets(ticketsVisibleTo(context.role, context.id, getCurrentPreviewTickets()));
        };
        refreshPreview();
        previewChannel = new BroadcastChannel("mis-support-preview-ticket-updates");
        previewChannel.onmessage = refreshPreview;
        const refreshAssignments = () => {
          setNewAssignments(getPreviewNotifications(context.id).filter(isAssignmentNotification));
        };
        if (context.role === "agent") {
          refreshAssignments();
          previewNotificationChannel = new BroadcastChannel("mis-support-preview-notifications");
          previewNotificationChannel.onmessage = refreshAssignments;
        }
        storageListener = (event) => {
          if (
            event.key === PREVIEW_CREATED_TICKETS_KEY ||
            event.key === PREVIEW_TICKET_STORAGE_KEY
          ) {
            refreshPreview();
          }
          if (event.key === PREVIEW_NOTIFICATIONS_KEY && context.role === "agent") {
            refreshAssignments();
          }
        };
        window.addEventListener("storage", storageListener);
        setLoadingTickets(false);
        return;
      }
      let query = supabase.from("tickets").select("*").order("created_at", { ascending: false });
      if (context.role === "agent") {
        query = query.eq("assignee_id", context.id);
      } else if (context.role === "employee") {
        query = query.eq("user_id", context.id);
      }
      const { data: t } = await query;
      setTickets(t ?? []);
      setLoadingTickets(false);

      if (isMisStaff(context.role) && t && t.length > 0) {
        const userIds = [...new Set(t.map((ticket) => ticket.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, department")
          .in("id", userIds);
        setRequesters(
          Object.fromEntries(
            (profiles ?? []).map((p) => [
              p.id,
              { full_name: p.full_name, email: p.email, department: p.department },
            ]),
          ),
        );
      }

      if (context.role === "agent") {
        const { data: n } = await supabase
          .from("notifications")
          .select("*")
          .eq("read", false)
          .ilike("title", "%assigned to you%")
          .order("created_at", { ascending: false });
        setNewAssignments(n ?? []);

        notificationChannel = supabase
          .channel(`dashboard-assignments-${context.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${context.id}`,
            },
            (payload) => {
              const inserted = payload.new as NotificationRow;
              if (isAssignmentNotification(inserted)) {
                setNewAssignments((current) => [inserted, ...current]);
              }
            },
          )
          .subscribe();
      }

      ticketChannel = supabase
        .channel(`dashboard-tickets-${context.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
          setTickets((current) => {
            if (payload.eventType === "DELETE") {
              const deleted = payload.old as Pick<TicketRow, "id">;
              return current.filter((ticket) => ticket.id !== deleted.id);
            }
            const changed = payload.new as TicketRow;
            const visible = ticketsVisibleTo(context.role, context.id, [changed]).length === 1;
            const exists = current.some((ticket) => ticket.id === changed.id);
            if (!visible) return current.filter((ticket) => ticket.id !== changed.id);
            if (exists) {
              return current.map((ticket) => (ticket.id === changed.id ? changed : ticket));
            }
            return [changed, ...current];
          });
        })
        .subscribe();
    })();

    return () => {
      active = false;
      if (storageListener) window.removeEventListener("storage", storageListener);
      previewChannel?.close();
      previewNotificationChannel?.close();
      if (ticketChannel) supabase.removeChannel(ticketChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, []);

  const feedbackReminders = useMemo(
    () => (role === "employee" ? tickets.filter((t) => t.status === "awaiting_feedback") : []),
    [tickets, role],
  );

  // The server only actually emails/re-notifies for tickets that have been
  // waiting an hour or more (see feedback-reminders.ts) — calling it here
  // whenever any awaiting_feedback ticket exists is safe and cheap.
  const remindersSentRef = useRef(false);
  useEffect(() => {
    if (role !== "employee" || isPreviewMode() || remindersSentRef.current) return;
    if (feedbackReminders.length === 0) return;
    remindersSentRef.current = true;
    void sendFeedbackReminders().catch((error) =>
      console.error("[dashboard] feedback reminder send failed", error),
    );
  }, [feedbackReminders, role]);

  const dashboardCopy = {
    employee: {
      heading: "My Support Dashboard",
      description:
        "Report MIS issues, track their progress, and continue conversations with support.",
      profileLine: profile?.department ? `${profile.department} Department` : "Department employee",
      statLabels: {
        open: "Open",
        inProgress: "In Progress",
        answered: "Answered",
        awaitingFeedback: "Awaiting Feedback",
        closed: "Closed",
        total: "All my requests",
      },
      statusChart: "My request status",
      categoryChart: "My issue categories",
      trendChart: "My 14-day request trend",
    },
    agent: {
      heading: "MIS Agent Workspace",
      description: "Focus on tickets assigned to you by the MIS Head and keep employees updated.",
      profileLine: "MIS Support Agent",
      statLabels: {
        open: "Open",
        inProgress: "In Progress",
        answered: "Answered",
        awaitingFeedback: "Awaiting Feedback",
        closed: "Closed",
        total: "Total assigned",
      },
      statusChart: "Assigned workload status",
      categoryChart: "Assigned issue categories",
      trendChart: "14-day assignment trend",
    },
    admin: {
      heading: "MIS Head Dashboard",
      description:
        "Monitor every department request, assign MIS agents, and control resolution progress.",
      profileLine: "MIS Department · Head",
      statLabels: {
        open: "Open",
        inProgress: "In Progress",
        answered: "Answered",
        awaitingFeedback: "Awaiting Feedback",
        closed: "Closed",
        total: "Total MIS queue",
      },
      statusChart: "MIS queue status",
      categoryChart: "Issues by category",
      trendChart: "14-day request volume",
    },
  }[role];

  const counts = tickets.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const stats = [
    {
      key: "open",
      label: dashboardCopy.statLabels.open,
      value: counts.open ?? 0,
      icon: AlertCircle,
      tone: "text-warning",
    },
    {
      key: "in_progress",
      label: dashboardCopy.statLabels.inProgress,
      value: counts.in_progress ?? 0,
      icon: Clock,
      tone: "text-primary",
    },
    {
      key: "answered",
      label: dashboardCopy.statLabels.answered,
      value: counts.answered ?? 0,
      icon: MessageSquare,
      tone: "text-accent",
    },
    {
      key: "awaiting_feedback",
      label: dashboardCopy.statLabels.awaitingFeedback,
      value: counts.awaiting_feedback ?? 0,
      icon: Clock,
      tone: "text-warning",
    },
    {
      key: "closed",
      label: dashboardCopy.statLabels.closed,
      value: (counts.closed ?? 0) + (counts.resolved ?? 0),
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      key: null as string | null,
      label: dashboardCopy.statLabels.total,
      value: tickets.length,
      icon: TrendingUp,
      tone: "text-accent",
    },
  ];

  // Interlinked filter: charts + list all respect activeStatus/activeCategory
  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!activeStatus || normalizedTicketStatus(t.status) === activeStatus) &&
          (!activeCategory || t.category === activeCategory),
      ),
    [tickets, activeStatus, activeCategory],
  );

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const status = normalizedTicketStatus(t.status);
      map[status] = (map[status] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => (map[t.category] = (map[t.category] ?? 0) + 1));
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const trendData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const count = filtered.filter((t) => t.created_at.slice(0, 10) === key).length;
      days.push({ day: label, count });
    }
    return days;
  }, [filtered]);

  const STATUS_COLORS: Record<string, string> = {
    open: "var(--warning)",
    in_progress: "var(--primary)",
    answered: "var(--accent)",
    awaiting_feedback: "var(--warning)",
    closed: "var(--success)",
    canceled: "var(--destructive)",
  };

  const isFiltering = Boolean(activeStatus || activeCategory);
  const recent = isFiltering ? filtered : filtered.slice(0, 5);
  const scopeLabel =
    role === "admin"
      ? "All department requests"
      : role === "agent"
        ? "Tickets assigned to you"
        : "Your submitted requests";
  const recentTitle = isFiltering
    ? `${filtered.length} matching ticket${filtered.length === 1 ? "" : "s"}`
    : role === "admin"
      ? "Recent MIS queue tickets"
      : role === "agent"
        ? "Recently assigned tickets"
        : "My recent tickets";

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {dashboardCopy.heading}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {dashboardCopy.description}
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {profile?.employee_id && role === "employee" ? `ID ${profile.employee_id} · ` : ""}
            {dashboardCopy.profileLine}
          </p>
        </div>
        <Link
          to={isMisStaff(role) ? "/tickets" : "/report"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90"
        >
          {isMisStaff(role) ? (
            <>
              <Ticket className="h-4 w-4" />
              {role === "admin" ? "Manage MIS Queue" : "View Assigned Tickets"}
            </>
          ) : (
            <>
              <PlusCircle className="h-4 w-4" /> Report a Problem
            </>
          )}
        </Link>
      </div>

      {role === "agent" && newAssignments.length > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold">
                  {newAssignments.length === 1
                    ? "New ticket assigned to you"
                    : `${newAssignments.length} new tickets assigned to you`}
                </h2>
                <ul className="mt-2 space-y-1">
                  {newAssignments.slice(0, 3).map((n) => (
                    <li key={n.id}>
                      <Link
                        to={n.link ?? "/tickets"}
                        onClick={() => dismissAssignment(n.id)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {n.body || n.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                {newAssignments.length > 3 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    +{newAssignments.length - 3} more
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => newAssignments.forEach((n) => dismissAssignment(n.id))}
              className="shrink-0 self-start text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Dismiss all
            </button>
          </div>
        </div>
      )}

      {role === "employee" && feedbackReminders.length > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">
                {feedbackReminders.length === 1
                  ? "MIS is waiting on your feedback"
                  : `MIS is waiting on your feedback for ${feedbackReminders.length} tickets`}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Please confirm whether the issue is fixed, or let us know it's still not working.
              </p>
              <ul className="mt-3 space-y-2">
                {feedbackReminders.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/tickets/$id"
                      params={{ id: t.id }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-background/50 px-3 py-2 text-sm transition hover:border-warning/60"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.ticket_no}
                        </span>{" "}
                        <span className="font-medium">{t.title}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-warning">
                        Respond now
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const isActive = activeStatus === s.key && s.key !== null;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setActiveStatus(isActive ? null : s.key)}
              className={`rounded-2xl border p-4 text-left backdrop-blur transition ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-surface/60 hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.tone}`} />
              </div>
              <p className="mt-3 text-3xl font-bold">{loadingTickets ? "—" : s.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {loadingTickets ? "Loading…" : s.key === null ? scopeLabel : scopeLabel}
              </p>
            </button>
          );
        })}
      </div>

      {(activeStatus || activeCategory) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filtering:</span>
          {activeStatus && (
            <button
              onClick={() => setActiveStatus(null)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20"
            >
              status: {activeStatus} ✕
            </button>
          )}
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/20"
            >
              category: {activeCategory} ✕
            </button>
          )}
        </div>
      )}

      {tickets.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur">
            <h3 className="mb-3 text-sm font-semibold">{dashboardCopy.statusChart}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  onClick={(e: { name?: string }) =>
                    setActiveStatus(activeStatus === e?.name ? null : (e?.name ?? null))
                  }
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name] ?? "var(--primary)"}
                      opacity={!activeStatus || activeStatus === entry.name ? 1 : 0.3}
                      cursor="pointer"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur">
            <h3 className="mb-3 text-sm font-semibold">{dashboardCopy.categoryChart}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(e: { name?: string }) =>
                    setActiveCategory(activeCategory === e?.name ? null : (e?.name ?? null))
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur">
            <h3 className="mb-3 text-sm font-semibold">{dashboardCopy.trendChart}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{recentTitle}</h2>
            <Link
              to="/tickets"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {loadingTickets
                  ? "Loading tickets…"
                  : role === "admin"
                    ? "The MIS queue is currently empty."
                    : role === "agent"
                      ? "No tickets are currently assigned to you."
                      : "You have not submitted a ticket yet."}
              </p>
              {!loadingTickets && role === "employee" && (
                <Link
                  to="/report"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <PlusCircle className="h-4 w-4" /> Create your first ticket
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  to="/tickets/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between gap-4 py-4 transition hover:opacity-80"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_no}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusStyles[t.status]}`}
                      >
                        {statusLabel[t.status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.category} ·{" "}
                      {isMisStaff(role) &&
                        `${requesters[t.user_id]?.full_name ?? requesters[t.user_id]?.email ?? "Unknown employee"} · ${requesters[t.user_id]?.department ?? "Dept not set"} · `}
                      {normalizedTicketStatus(t.status) === "closed" && t.closed_at
                        ? `Closed ${new Date(t.closed_at).toLocaleString()}`
                        : `Updated ${new Date(t.updated_at).toLocaleString()}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {role === "employee" && (
            <QuickAction
              to="/report"
              icon={Ticket}
              title="Report a problem"
              desc="Open a new ticket with AI-assisted triage."
            />
          )}
          <QuickAction
            to="/tickets"
            icon={MessageSquare}
            title={
              role === "admin"
                ? "MIS Head queue"
                : role === "agent"
                  ? "Assigned tickets"
                  : "My tickets"
            }
            desc={
              role === "admin"
                ? "Assign and manage every department request."
                : role === "agent"
                  ? "Work on tickets assigned by the MIS Head."
                  : "Track status and chat with MIS support."
            }
          />
          <QuickAction
            to="/kb"
            icon={BookOpen}
            title="Knowledge base"
            desc="Self-help guides and past resolutions."
          />
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-5">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> AI Tip
            </div>
            <p className="text-sm font-medium leading-snug">
              Attach a screenshot when reporting. Groq Vision reads visible errors, writes the
              description, and selects the MIS category.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: "/report" | "/tickets" | "/kb";
  icon: typeof Ticket;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-surface/60 p-4 backdrop-blur transition hover:border-primary/50 hover:bg-surface"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
    </Link>
  );
}

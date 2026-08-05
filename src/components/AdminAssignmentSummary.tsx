import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ChevronRight, Clock3, Inbox, UserCheck, UsersRound, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizedTicketStatus,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
} from "@/lib/ticket-status";
import { getCategoryLabel } from "@/lib/ticket-categories";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];

export type AssignmentPerson = {
  full_name: string | null;
  email: string | null;
  department: string | null;
};

export type AssignmentAgent = {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_count: number;
};

type Props = {
  tickets: TicketRow[];
  people: Record<string, AssignmentPerson>;
  agents: AssignmentAgent[];
  loading: boolean;
};

const priorityStyles: Record<TicketRow["priority"], string> = {
  low: "border-border bg-muted/40 text-muted-foreground",
  medium: "border-primary/25 bg-primary/10 text-primary",
  high: "border-warning/30 bg-warning/10 text-warning",
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
};

function displayPerson(person: AssignmentPerson | undefined, fallback: string) {
  return person?.full_name ?? person?.email ?? fallback;
}

type SummaryFilter = "assigned" | "active" | "unassigned" | "awaiting" | null;

const FILTER_LABELS: Record<Exclude<SummaryFilter, null>, string> = {
  assigned: "Assigned",
  active: "Active Work",
  unassigned: "Unassigned",
  awaiting: "Awaiting Feedback",
};

export function AdminAssignmentSummary({ tickets, people, agents, loading }: Props) {
  const [filter, setFilter] = useState<SummaryFilter>(null);

  const assignedTickets = tickets.filter((ticket) => ticket.assignee_id);
  const unassignedTickets = tickets.filter((ticket) => !ticket.assignee_id);
  const activeTickets = assignedTickets.filter(
    (ticket) => !["closed", "resolved", "canceled"].includes(ticket.status),
  );
  const awaitingTickets = assignedTickets.filter((ticket) => ticket.status === "awaiting_feedback");

  const filteredTickets =
    filter === "assigned"
      ? assignedTickets
      : filter === "active"
        ? activeTickets
        : filter === "unassigned"
          ? unassignedTickets
          : filter === "awaiting"
            ? awaitingTickets
            : tickets;

  const workload = agents.map((agent) => {
    const agentTickets = tickets.filter((ticket) => ticket.assignee_id === agent.id);
    return {
      ...agent,
      total: agentTickets.length,
      active: agentTickets.filter(
        (ticket) => !["closed", "resolved", "canceled"].includes(ticket.status),
      ).length,
      awaiting: agentTickets.filter((ticket) => ticket.status === "awaiting_feedback").length,
      closed: agentTickets.filter((ticket) => ["closed", "resolved"].includes(ticket.status))
        .length,
    };
  });

  const sortedTickets = [...filteredTickets].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-surface/60 backdrop-blur">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">MIS Assignment Summary</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Live responsibility, employee department, priority, and current progress for every
              request.
            </p>
          </div>
          <Link
            to="/tickets"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Manage full queue <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryMetric
            icon={UserCheck}
            label="Assigned"
            value={assignedTickets.length}
            detail="Tickets with an MIS owner"
            active={filter === "assigned"}
            onClick={() => setFilter((current) => (current === "assigned" ? null : "assigned"))}
          />
          <SummaryMetric
            icon={Clock3}
            label="Active Work"
            value={activeTickets.length}
            detail="Currently being handled"
            active={filter === "active"}
            onClick={() => setFilter((current) => (current === "active" ? null : "active"))}
          />
          <SummaryMetric
            icon={Inbox}
            label="Unassigned"
            value={unassignedTickets.length}
            detail="MIS Head action required"
            warning={unassignedTickets.length > 0}
            active={filter === "unassigned"}
            onClick={() => setFilter((current) => (current === "unassigned" ? null : "unassigned"))}
          />
          <SummaryMetric
            icon={CheckCircle2}
            label="Awaiting Feedback"
            value={awaitingTickets.length}
            detail="Employee confirmation pending"
            active={filter === "awaiting"}
            onClick={() => setFilter((current) => (current === "awaiting" ? null : "awaiting"))}
          />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Ticket Assignment Details</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Most recently updated requests appear first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filter && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
              >
                Filtering: {FILTER_LABELS[filter]}
                <X className="h-3 w-3" />
              </button>
            )}
            <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-xs text-muted-foreground">
              {filteredTickets.length} {filter ? "matching" : "total"}
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Ticket / Issue</th>
                <th className="px-4 py-3 font-semibold">Reported By</th>
                <th className="px-4 py-3 font-semibold">Assigned To</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Current Status</th>
                <th className="px-4 py-3 font-semibold">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedTickets.map((ticket) => {
                const requester = people[ticket.user_id];
                const assignee = ticket.assignee_id ? people[ticket.assignee_id] : undefined;
                const status = normalizedTicketStatus(ticket.status);
                return (
                  <tr key={ticket.id} className="bg-background/20 transition hover:bg-muted/25">
                    <td className="px-4 py-3.5">
                      <Link
                        to="/tickets/$id"
                        params={{ id: ticket.id }}
                        className="group block max-w-[300px]"
                      >
                        <span className="font-mono text-[11px] text-primary">
                          {ticket.ticket_no}
                        </span>
                        <span className="mt-0.5 block truncate font-medium group-hover:underline">
                          {ticket.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {getCategoryLabel(ticket.category)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium">{displayPerson(requester, "Unknown employee")}</p>
                      <p className="text-xs text-muted-foreground">
                        {requester?.department ?? "Department not set"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {ticket.assignee_id ? (
                        <>
                          <p className="font-medium">{displayPerson(assignee, "MIS Agent")}</p>
                          <p className="text-xs text-muted-foreground">MIS Department</p>
                        </>
                      ) : (
                        <span className="inline-flex rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
                          Awaiting Assignment
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${priorityStyles[ticket.priority]}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${TICKET_STATUS_STYLES[status]}`}
                      >
                        {TICKET_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {new Date(ticket.updated_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {!loading && sortedTickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {filter
                      ? `No tickets match "${FILTER_LABELS[filter]}".`
                      : "No department tickets have been submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-7">
          <h3 className="text-sm font-semibold">MIS Team Workload</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Current ticket distribution across MIS agents.
          </p>
        </div>

        {workload.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {loading ? "Loading MIS team workload…" : "No MIS agents are available yet."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workload.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                    {(agent.full_name ?? agent.email ?? "M")
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {agent.full_name ?? agent.email ?? "MIS Agent"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <WorkloadCount label="Total" value={agent.total} />
                  <WorkloadCount label="Active" value={agent.active} />
                  <WorkloadCount label="Feedback" value={agent.awaiting} />
                  <WorkloadCount label="Closed" value={agent.closed} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
  active = false,
  onClick,
}: {
  icon: typeof UserCheck;
  label: string;
  value: number;
  detail: string;
  warning?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3.5 text-left transition ${
        active
          ? "border-primary bg-primary/10"
          : "border-border/60 bg-background/45 hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon className={`h-4 w-4 ${warning ? "text-warning" : "text-primary"}`} />
      </div>
      <p className={`mt-2 text-2xl font-black ${warning ? "text-warning" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
    </button>
  );
}

function WorkloadCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/35 px-1 py-2">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

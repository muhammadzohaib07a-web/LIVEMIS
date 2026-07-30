import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminAssignmentSummary,
  type AssignmentAgent,
  type AssignmentPerson,
} from "@/components/AdminAssignmentSummary";
import type { Database } from "@/integrations/supabase/types";
import { isPreviewMode } from "@/lib/preview-auth";
import { getCurrentUserContext } from "@/lib/current-user";
import {
  getCurrentPreviewTickets,
  previewAgents,
  previewRequesters,
  PREVIEW_CREATED_TICKETS_KEY,
  PREVIEW_TICKET_STORAGE_KEY,
} from "@/lib/preview-data";

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "MIS Assignment Summary — MIS Support Hub" },
      {
        name: "description",
        content: "Live ticket responsibility, MIS team workload, and assignment details.",
      },
    ],
  }),
  component: AssignmentSummaryPage,
});

function AssignmentSummaryPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [people, setPeople] = useState<Record<string, AssignmentPerson>>({});
  const [agents, setAgents] = useState<AssignmentAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ticketChannel: ReturnType<typeof supabase.channel> | null = null;
    let previewChannel: BroadcastChannel | null = null;
    let storageListener: ((event: StorageEvent) => void) | null = null;
    let active = true;

    (async () => {
      const context = await getCurrentUserContext();
      if (!context || !active) {
        setLoading(false);
        return;
      }
      if (context.role !== "admin") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      if (isPreviewMode()) {
        setPeople({
          ...previewRequesters,
          ...Object.fromEntries(
            previewAgents.map((agent) => [
              agent.id,
              { full_name: agent.full_name, email: agent.email, department: "MIS" },
            ]),
          ),
        });
        setAgents(previewAgents);
        const refreshPreview = () => {
          setTickets(getCurrentPreviewTickets());
        };
        refreshPreview();
        previewChannel = new BroadcastChannel("mis-support-preview-ticket-updates");
        previewChannel.onmessage = refreshPreview;
        storageListener = (event) => {
          if (
            event.key === PREVIEW_CREATED_TICKETS_KEY ||
            event.key === PREVIEW_TICKET_STORAGE_KEY
          ) {
            refreshPreview();
          }
        };
        window.addEventListener("storage", storageListener);
        setLoading(false);
        return;
      }

      const [{ data: t }, { data: profileRows }, { data: agentRows }] = await Promise.all([
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, department"),
        supabase.rpc("list_mis_agents"),
      ]);
      setTickets(t ?? []);
      setPeople(
        Object.fromEntries(
          (profileRows ?? []).map((person) => [
            person.id,
            { full_name: person.full_name, email: person.email, department: person.department },
          ]),
        ),
      );
      setAgents(agentRows ?? []);
      setLoading(false);

      ticketChannel = supabase
        .channel(`assignments-tickets-${context.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
          setTickets((current) => {
            if (payload.eventType === "DELETE") {
              const deleted = payload.old as Pick<TicketRow, "id">;
              return current.filter((ticket) => ticket.id !== deleted.id);
            }
            const changed = payload.new as TicketRow;
            const exists = current.some((ticket) => ticket.id === changed.id);
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
      if (ticketChannel) supabase.removeChannel(ticketChannel);
    };
  }, [navigate]);

  return (
    <>
      <AdminAssignmentSummary tickets={tickets} people={people} agents={agents} loading={loading} />
    </>
  );
}

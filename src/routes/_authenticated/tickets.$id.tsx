import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Database } from "@/integrations/supabase/types";
import {
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Building2,
  Hourglass,
  MessageCircle,
  RotateCcw,
  XCircle,
  Smile,
  AtSign,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserContext, isMisStaff, type AppRole } from "@/lib/current-user";
import { isPreviewMode } from "@/lib/preview-auth";
import {
  getCurrentPreviewTickets,
  getPreviewTicket,
  getPreviewMessages,
  PREVIEW_CHAT_STORAGE_KEY,
  PREVIEW_TICKET_STORAGE_KEY,
  previewAgents,
  previewRequesters,
  storePreviewNotification,
  storePreviewMessage,
  storePreviewTicket,
  storePreviewTicketUpdate,
} from "@/lib/preview-data";
import { getCategoryLabel } from "@/lib/ticket-categories";
import {
  formatStatusChangeMessage,
  isStatusChangeMessage,
  MIS_STATUS_TRANSITIONS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-status";
import { mentionOptionsForRole } from "@/lib/mentions";

const QUICK_EMOJIS = [
  "👍", "👎", "😀", "😂", "😊", "🙏", "👏", "🎉",
  "✅", "❌", "🔥", "💯", "😢", "😡", "🤔", "👀",
  "🚀", "⚠️", "📌", "⏰", "💡", "🙌", "🤝", "😅",
  "🛠️", "📎", "📄", "🔧", "💻", "🖨️", "📊", "🧾",
];

const CHAT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10MB, matches storage bucket limit
const CHAT_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type Message = Database["public"]["Tables"]["ticket_messages"]["Row"];
type Status = Database["public"]["Enums"]["ticket_status"];
type MisAgent = {
  id: string;
  full_name: string | null;
  email: string | null;
  assigned_count: number;
};
type SenderIdentity = {
  full_name: string | null;
  email: string | null;
  department: string | null;
  role?: AppRole;
};
type TicketAttachment = {
  name: string;
  type: string;
  size: number;
  path?: string;
  data_url?: string;
  ai_analyzed?: boolean;
};

function getTicketAttachments(value: unknown): TicketAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TicketAttachment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as TicketAttachment).name === "string" &&
      typeof (item as TicketAttachment).type === "string" &&
      typeof (item as TicketAttachment).size === "number",
  );
}

const MENTION_TAGS = ["@Everyone", "@Admin", "@Employee", "@Team"];

function renderMessageBody(body: string, mine: boolean) {
  return body
    .split(/(@Everyone|@Admin|@Employee|@Team)/g)
    .map((part, index) =>
      MENTION_TAGS.includes(part) ? (
        <span
          key={index}
          className={`font-semibold underline decoration-2 underline-offset-2 ${
            mine ? "text-primary-foreground" : "text-primary"
          }`}
        >
          {part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
}

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Ticket ${params.id.slice(0, 6)} — MIS Support Hub` },
      { name: "description", content: "View ticket details and chat with the MIS support team." },
      { property: "og:title", content: "Ticket — MIS Support Hub" },
      { property: "og:description", content: "Ticket details and support chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketDetail,
});

const statusMeta: Record<Status, { label: string; icon: typeof Clock; cls: string }> = {
  open: { label: "Open", icon: AlertCircle, cls: "bg-warning/15 text-warning border-warning/30" },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    cls: "bg-primary/15 text-primary border-primary/30",
  },
  answered: {
    label: "Answered",
    icon: MessageCircle,
    cls: "bg-accent/15 text-accent border-accent/30",
  },
  awaiting_feedback: {
    label: "Awaiting Customer Feedback",
    icon: Hourglass,
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  resolved: {
    label: "Closed",
    icon: CheckCircle2,
    cls: "bg-success/15 text-success border-success/30",
  },
  closed: {
    label: "Closed",
    icon: CheckCircle2,
    cls: "bg-success/15 text-success border-success/30",
  },
  canceled: {
    label: "Canceled",
    icon: XCircle,
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [followUps, setFollowUps] = useState<Ticket[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingFix, setConfirmingFix] = useState(false);
  const [role, setRole] = useState<AppRole>("employee");
  const [requester, setRequester] = useState<{
    full_name: string | null;
    department: string | null;
    email: string | null;
  } | null>(null);
  const [messageSenders, setMessageSenders] = useState<Record<string, SenderIdentity>>({});
  const [agents, setAgents] = useState<MisAgent[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "fallback">(
    "connecting",
  );
  const [chatError, setChatError] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [messageAttachmentUrls, setMessageAttachmentUrls] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const previewChannelRef = useRef<BroadcastChannel | null>(null);
  const previewTicketChannelRef = useRef<BroadcastChannel | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedAttachmentPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isPreviewMode()) {
      const previewChannel = new BroadcastChannel("mis-support-preview-chat");
      const previewTicketChannel = new BroadcastChannel("mis-support-preview-ticket-updates");
      previewChannelRef.current = previewChannel;
      previewTicketChannelRef.current = previewTicketChannel;
      previewChannel.onmessage = (event: MessageEvent<Message>) => {
        const incoming = event.data;
        if (incoming.ticket_id !== id) return;
        setMessages((current) =>
          current.some((message) => message.id === incoming.id) ? current : [...current, incoming],
        );
      };
      previewTicketChannel.onmessage = (event: MessageEvent<Partial<Ticket> & { id: string }>) => {
        if (event.data.id !== id) return;
        setTicket((current) => (current ? { ...current, ...event.data } : current));
      };
      const syncStoredMessages = (event: StorageEvent) => {
        if (event.key === PREVIEW_CHAT_STORAGE_KEY) {
          setMessages(getPreviewMessages(id));
        }
        if (event.key === PREVIEW_TICKET_STORAGE_KEY) {
          setTicket(getPreviewTicket(id));
        }
      };
      window.addEventListener("storage", syncStoredMessages);
      setRealtimeStatus("live");
      getCurrentUserContext().then((context) => {
        const previewTicket = getPreviewTicket(id);
        setMe(context?.id ?? null);
        setRole(context?.role ?? "employee");
        setTicket(previewTicket);
        setMessages(getPreviewMessages(id));
        setFollowUps(
          getCurrentPreviewTickets().filter((candidate) => candidate.parent_ticket_id === id),
        );
        if (previewTicket) {
          setRequester(
            previewRequesters[previewTicket.user_id as keyof typeof previewRequesters] ?? null,
          );
        }
        if (context?.role === "admin") setAgents(previewAgents);
        setMessageSenders({
          ...Object.fromEntries(
            Object.entries(previewRequesters).map(([senderId, profile]) => [
              senderId,
              { ...profile, role: "employee" as AppRole },
            ]),
          ),
          ...Object.fromEntries(
            previewAgents.map((agent) => [
              agent.id,
              {
                full_name: agent.full_name,
                email: agent.email,
                department: "MIS",
                role: "agent" as AppRole,
              },
            ]),
          ),
          "preview-head": {
            full_name: "Tahir Ghaffar",
            email: "mis.head@mill.local",
            department: "MIS",
            role: "admin",
          },
        });
        setLoading(false);
      });
      return () => {
        window.removeEventListener("storage", syncStoredMessages);
        previewChannel.close();
        previewTicketChannel.close();
        previewChannelRef.current = null;
        previewTicketChannelRef.current = null;
      };
    }
    (async () => {
      const context = await getCurrentUserContext();
      setMe(context?.id ?? null);
      setRole(context?.role ?? "employee");
      const [ticketResult, messagesResult, followUpsResult] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", id).maybeSingle(),
        supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at"),
        supabase
          .from("tickets")
          .select("*")
          .eq("parent_ticket_id", id)
          .order("created_at", { ascending: false }),
      ]);
      const t = ticketResult.data;
      const msgs = messagesResult.data;
      if (messagesResult.error) setChatError(messagesResult.error.message);
      setTicket(t);
      setMessages(msgs ?? []);
      setFollowUps(followUpsResult.data ?? []);
      const senderIds = [
        ...new Set([
          ...(msgs ?? []).map((message) => message.sender_id),
          ...(context?.id ? [context.id] : []),
          ...(t?.user_id ? [t.user_id] : []),
          ...(t?.assignee_id ? [t.assignee_id] : []),
        ]),
      ];
      if (senderIds.length > 0) {
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, department, email")
          .in("id", senderIds);
        setMessageSenders(
          Object.fromEntries(
            (senderProfiles ?? []).map((profile) => [
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
      if (t && context && isMisStaff(context.role)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, department, email")
          .eq("id", t.user_id)
          .maybeSingle();
        setRequester(profile);
      }
      if (context?.role === "admin") {
        const { data: agentRows } = await supabase.rpc("list_mis_agents");
        setAgents(agentRows ?? []);
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`ticket_${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${id}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming],
          );
          void supabase
            .from("profiles")
            .select("id, full_name, department, email")
            .eq("id", incoming.sender_id)
            .maybeSingle()
            .then(({ data: profile }) => {
              if (!profile) return;
              setMessageSenders((current) => ({
                ...current,
                [profile.id]: {
                  full_name: profile.full_name,
                  department: profile.department,
                  email: profile.email,
                },
              }));
            });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updatedTicket = payload.new as Ticket;
          setTicket((current) => {
            if (current && current.status !== updatedTicket.status) {
              toast.info(`Ticket status updated to ${statusMeta[updatedTicket.status].label}`);
            }
            return updatedTicket;
          });
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(status === "SUBSCRIBED" ? "live" : "fallback");
      });

    // Polling keeps chat usable if a firewall blocks the Realtime websocket.
    const fallbackPoll = window.setInterval(async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at");
      if (data) {
        setMessages(data);
        setChatError(null);
      }
      if (error) setChatError(error.message);

      const { data: refreshedTicket } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (refreshedTicket) setTicket(refreshedTicket);
    }, 7000);

    return () => {
      window.clearInterval(fallbackPoll);
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!ticket) {
      setAttachmentUrls({});
      return;
    }
    const attachments = getTicketAttachments(ticket.attachments);
    if (isPreviewMode()) {
      setAttachmentUrls(
        Object.fromEntries(
          attachments
            .filter((attachment) => attachment.data_url)
            .map((attachment) => [attachment.name, attachment.data_url as string]),
        ),
      );
      return;
    }
    let active = true;
    void Promise.all(
      attachments
        .filter((attachment) => attachment.path)
        .map(async (attachment) => {
          const { data } = await supabase.storage
            .from("ticket-attachments")
            .createSignedUrl(attachment.path as string, 3600);
          return [attachment.name, data?.signedUrl] as const;
        }),
    ).then((entries) => {
      if (!active) return;
      setAttachmentUrls(
        Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1]))),
      );
    });
    return () => {
      active = false;
    };
  }, [ticket]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Chat attachments carry a storage `path` (private bucket); resolve each newly
  // seen one to a signed URL once and cache it, instead of re-signing on every
  // new message. Preview-mode attachments already carry a ready-to-use data_url.
  useEffect(() => {
    if (isPreviewMode()) return;
    const newPaths = messages
      .flatMap((m) => getTicketAttachments(m.attachments))
      .map((attachment) => attachment.path)
      .filter((path): path is string => !!path && !resolvedAttachmentPaths.current.has(path));
    if (newPaths.length === 0) return;
    newPaths.forEach((path) => resolvedAttachmentPaths.current.add(path));
    let active = true;
    void Promise.all(
      newPaths.map(async (path) => {
        const { data } = await supabase.storage.from("ticket-attachments").createSignedUrl(path, 3600);
        return [path, data?.signedUrl] as const;
      }),
    ).then((entries) => {
      if (!active) return;
      setMessageAttachmentUrls((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1]))),
      }));
    });
    return () => {
      active = false;
    };
  }, [messages]);

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((current) => `${current}${text}`);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + text.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!CHAT_ATTACHMENT_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > CHAT_ATTACHMENT_MAX_SIZE) {
        toast.error(`${file.name}: file is larger than 10MB`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setPendingFiles((current) => [...current, ...accepted]);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if ((!text && pendingFiles.length === 0) || !me) return;
    setSending(true);
    setBody("");
    const filesToSend = pendingFiles;
    setPendingFiles([]);
    if (isPreviewMode()) {
      const attachments: TicketAttachment[] = filesToSend.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        data_url: URL.createObjectURL(file),
      }));
      const message: Message = {
        id: `preview-message-${Date.now()}`,
        ticket_id: id,
        sender_id: me,
        body: text,
        attachments,
        created_at: new Date().toISOString(),
      };
      setMessages((current) => [...current, message]);
      storePreviewMessage(message);
      previewChannelRef.current?.postMessage(message);
      setSending(false);
      return;
    }
    const attachments: TicketAttachment[] = [];
    for (const file of filesToSend) {
      const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-");
      const path = `${me}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        toast.error(`${file.name} upload failed: ${uploadError.message}`);
        continue;
      }
      attachments.push({ name: file.name, type: file.type, size: file.size, path });
    }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id,
      sender_id: me,
      body: text,
      attachments,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      setBody(text);
      setPendingFiles(filesToSend);
    }
  };

  const confirmIssueFixed = async () => {
    if (
      !ticket ||
      !me ||
      role !== "employee" ||
      ticket.user_id !== me ||
      ticket.status !== "awaiting_feedback"
    )
      return;
    const confirmation = "✅ Customer confirmation: The issue is fixed. MIS Head may close it.";
    setConfirmingFix(true);
    if (isPreviewMode()) {
      const message: Message = {
        id: `preview-confirmation-${Date.now()}`,
        ticket_id: id,
        sender_id: me,
        body: confirmation,
        attachments: [],
        created_at: new Date().toISOString(),
      };
      setMessages((current) => [...current, message]);
      storePreviewMessage(message);
      previewChannelRef.current?.postMessage(message);
      setConfirmingFix(false);
      toast.success("Confirmation sent to the MIS Head for final closure");
      return;
    }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id,
      sender_id: me,
      body: confirmation,
    });
    setConfirmingFix(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation sent to the MIS Head for final closure");
  };

  const updateStatus = async (s: Status) => {
    const canManage = role === "admin" || (role === "agent" && ticket?.assignee_id === me);
    const canGiveCustomerFeedback =
      role === "employee" &&
      ticket?.user_id === me &&
      ticket.status === "awaiting_feedback" &&
      (s === "closed" || s === "in_progress");
    if (!canManage && !canGiveCustomerFeedback) return;
    const previousStatus = ticket?.status;
    if (isPreviewMode()) {
      const update = {
        id,
        status: s,
        closed_at: s === "closed" || s === "resolved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      setTicket((current) => (current ? { ...current, ...update } : current));
      storePreviewTicketUpdate(id, update);
      previewTicketChannelRef.current?.postMessage(update);
      if (previousStatus && previousStatus !== s) {
        const statusMessage: Message = {
          id: `preview-status-${Date.now()}`,
          ticket_id: id,
          sender_id: me ?? ticket?.user_id ?? "preview-employee",
          body: formatStatusChangeMessage(previousStatus, s),
          attachments: [],
          created_at: new Date().toISOString(),
        };
        setMessages((current) => [...current, statusMessage]);
        storePreviewMessage(statusMessage);
        previewChannelRef.current?.postMessage(statusMessage);
      }
      toast.success(`Marked ${statusMeta[s].label}`);
      return;
    }
    const { error } = await supabase.from("tickets").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    setTicket((t) => (t ? { ...t, status: s } : t));
    toast.success(`Marked ${statusMeta[s].label}`);
  };

  const createFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const reason = followUpText.trim();
    if (
      !ticket ||
      !me ||
      role !== "employee" ||
      ticket.user_id !== me ||
      ticket.status !== "closed" ||
      reason.length < 10
    ) {
      toast.error("Please explain the new suggestion or recurring issue");
      return;
    }
    setCreatingFollowUp(true);
    if (isPreviewMode()) {
      const createdAt = new Date().toISOString();
      const followUp: Ticket = {
        id: crypto.randomUUID(),
        ticket_no: `F-${String(Date.now()).slice(-6)}`,
        user_id: me,
        assignee_id: null,
        title: `Follow-up: ${ticket.title}`,
        description: reason,
        follow_up_reason: reason,
        parent_ticket_id: ticket.id,
        category: ticket.category,
        priority: ticket.priority,
        status: "open",
        attachments: [],
        closed_at: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
      storePreviewTicket(followUp);
      const channel = new BroadcastChannel("mis-support-preview-ticket-updates");
      channel.postMessage(followUp);
      channel.close();
      setCreatingFollowUp(false);
      toast.success("Linked follow-up sent to the MIS Head");
      navigate({ to: "/tickets/$id", params: { id: followUp.id } });
      return;
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        user_id: me,
        assignee_id: null,
        title: `Follow-up: ${ticket.title}`,
        description: reason,
        follow_up_reason: reason,
        parent_ticket_id: ticket.id,
        category: ticket.category,
        priority: ticket.priority,
        status: "open",
        attachments: [],
      })
      .select("*")
      .single();
    setCreatingFollowUp(false);
    if (error || !data) {
      toast.error(error?.message ?? "Follow-up could not be created");
      return;
    }
    toast.success(`${data.ticket_no} linked to the original closed issue`);
    navigate({ to: "/tickets/$id", params: { id: data.id } });
  };

  const assignTicket = async (assigneeId: string) => {
    if (role !== "admin") return;
    if (isPreviewMode()) {
      const nextStatus: Status =
        ticket?.status === "open" ? "in_progress" : (ticket?.status ?? "open");
      const update = {
        id,
        assignee_id: assigneeId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      setTicket((current) => (current ? { ...current, ...update } : current));
      storePreviewTicketUpdate(id, update);
      previewTicketChannelRef.current?.postMessage(update);
      if (ticket?.status && ticket.status !== nextStatus) {
        const statusMessage: Message = {
          id: `preview-status-${Date.now()}`,
          ticket_id: id,
          sender_id: me ?? ticket?.user_id ?? "preview-employee",
          body: formatStatusChangeMessage(ticket.status, nextStatus),
          attachments: [],
          created_at: new Date().toISOString(),
        };
        setMessages((current) => [...current, statusMessage]);
        storePreviewMessage(statusMessage);
        previewChannelRef.current?.postMessage(statusMessage);
      }
      if (ticket?.assignee_id !== assigneeId) {
        const assignee = previewAgents.find((agent) => agent.id === assigneeId);
        const notification: Database["public"]["Tables"]["notifications"]["Row"] = {
          id: crypto.randomUUID(),
          user_id: assigneeId,
          title: `Task assigned: ${ticket?.ticket_no ?? "MIS ticket"}`,
          body: `Tahir Ghaffar (MIS Head) assigned "${ticket?.title ?? "a support ticket"}" to you. Open the ticket and update its status.`,
          link: `/tickets/${id}`,
          read: false,
          created_at: new Date().toISOString(),
        };
        storePreviewNotification(notification);
        const notificationChannel = new BroadcastChannel("mis-support-preview-notifications");
        notificationChannel.postMessage(notification);
        notificationChannel.close();
        toast.success(`Assigned to ${assignee?.full_name ?? assignee?.email ?? "MIS Agent"}`);
      } else {
        toast.success("Ticket assignment unchanged");
      }
      return;
    }
    const { error } = await supabase
      .from("tickets")
      .update({
        assignee_id: assigneeId,
        status: ticket?.status === "open" ? "in_progress" : ticket?.status,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setTicket((current) =>
      current
        ? {
            ...current,
            assignee_id: assigneeId,
            status: current.status === "open" ? "in_progress" : current.status,
          }
        : current,
    );
    toast.success("Ticket assigned by MIS Head");
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-2xl font-bold">Ticket not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been removed.</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/tickets" })}>
            Back to tickets
          </Button>
        </div>
      </>
    );
  }

  const sm = statusMeta[ticket.status];
  const StatusIcon = sm.icon;
  const nextStatuses = MIS_STATUS_TRANSITIONS[ticket.status].filter(
    (status) => status !== "closed" || role === "admin",
  );
  const canManageStatus = role === "admin" || (role === "agent" && ticket.assignee_id === me);
  const canGiveFeedback =
    role === "employee" && ticket.user_id === me && ticket.status === "awaiting_feedback";
  // Only count a confirmation sent during the *current* awaiting_feedback cycle: a ticket
  // can cycle through awaiting_feedback more than once, and ticket.updated_at is bumped
  // every time the tickets row changes (including the transition into this status), so a
  // confirmation from an earlier round always predates it.
  const customerConfirmed = messages.some(
    (message) =>
      message.sender_id === me &&
      message.body.startsWith("✅ Customer confirmation:") &&
      new Date(message.created_at) >= new Date(ticket.updated_at),
  );
  const canCreateFollowUp =
    role === "employee" && ticket.user_id === me && ticket.status === "closed";
  const mentionOptions = mentionOptionsForRole(role, requester?.full_name ?? requester?.email ?? null);

  return (
    <>
      <Link
        to="/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <div className="gap-6 lg:flex lg:h-[calc(100vh-12rem)]">
        <div className="space-y-6 lg:w-[42%] lg:min-w-0 lg:overflow-y-auto lg:pr-1">
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_no}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${sm.cls}`}
              >
                <StatusIcon className="h-3 w-3" /> {sm.label}
              </span>
              <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {ticket.priority}
              </span>
              <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {getCategoryLabel(ticket.category)}
              </span>
            </div>
            {ticket.parent_ticket_id && (
              <Link
                to="/tickets/$id"
                params={{ id: ticket.parent_ticket_id }}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Follow-up to original ticket
              </Link>
            )}
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{ticket.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {ticket.description}
            </p>
            {getTicketAttachments(ticket.attachments).length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Attached screenshot
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {getTicketAttachments(ticket.attachments).map((attachment) => {
                    const imageUrl = attachmentUrls[attachment.name];
                    return (
                      <div
                        key={attachment.path ?? attachment.name}
                        className="overflow-hidden rounded-xl border border-border bg-background/60"
                      >
                        {imageUrl ? (
                          <a href={imageUrl} target="_blank" rel="noreferrer">
                            <img
                              src={imageUrl}
                              alt={attachment.name}
                              className="h-44 w-full object-contain"
                            />
                          </a>
                        ) : (
                          <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                            Loading screenshot…
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
                          <span className="truncate font-medium">{attachment.name}</span>
                          {attachment.ai_analyzed && (
                            <span className="shrink-0 text-primary">AI analyzed</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Opened {new Date(ticket.created_at).toLocaleString()}
              {ticket.closed_at && <> · Closed {new Date(ticket.closed_at).toLocaleString()}</>}
            </p>
            {isMisStaff(role) && (
              <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
                <span className="font-semibold">
                  {requester?.full_name ?? requester?.email ?? "Employee"}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {requester?.department ?? "Department not set"}
                </span>
              </div>
            )}
            {followUps.length > 0 && (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Linked follow-ups
                </p>
                <div className="mt-2 space-y-2">
                  {followUps.map((followUp) => (
                    <Link
                      key={followUp.id}
                      to="/tickets/$id"
                      params={{ id: followUp.id }}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs transition hover:border-primary/40"
                    >
                      <span className="font-semibold">
                        {followUp.ticket_no} · {followUp.title}
                      </span>
                      <span className="text-muted-foreground">
                        {TICKET_STATUS_LABELS[followUp.status]}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canGiveFeedback && (
            <div className="mt-6 rounded-2xl border border-warning/35 bg-warning/10 p-5">
              <h2 className="font-bold">MIS is awaiting your feedback</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm the solution for the MIS Head, or return the ticket to the assigned agent.
                Only the MIS Head can perform the final close.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void confirmIssueFixed()}
                  disabled={confirmingFix || customerConfirmed}
                >
                  {confirmingFix ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {customerConfirmed ? "Confirmation Sent" : "Issue Fixed — Notify MIS Head"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void updateStatus("in_progress")}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Need More Help
                </Button>
              </div>
            </div>
          )}

          {canCreateFollowUp && (
            <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h2 className="font-bold">New suggestion about this closed issue?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a linked follow-up. The original resolution stays preserved for audit.
              </p>
              {showFollowUp ? (
                <form onSubmit={createFollowUp} className="mt-4 space-y-3">
                  <Textarea
                    value={followUpText}
                    onChange={(event) => setFollowUpText(event.target.value)}
                    placeholder="Explain what returned, changed, or what new suggestion you have…"
                    minLength={10}
                    maxLength={1000}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={creatingFollowUp}>
                      {creatingFollowUp ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Send Linked Follow-up
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowFollowUp(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowFollowUp(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Create Follow-up
                </Button>
              )}
            </div>
          )}

          {role === "admin" && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="h-4 w-4" /> MIS Head Assignment
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Select the MIS agent responsible for this issue.
              </p>
              <Select value={ticket.assignee_id ?? undefined} onValueChange={assignTicket}>
                <SelectTrigger className="mt-3">
                  <SelectValue placeholder="Assign an MIS agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name ?? agent.email ?? "MIS Agent"} ({agent.assigned_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-5 backdrop-blur">
            <h3 className="text-sm font-semibold">Status</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {role === "admin"
                ? "Move the ticket through the approved support lifecycle."
                : role === "agent" && ticket.assignee_id === me
                  ? "Move your assigned ticket to its next valid stage."
                  : "MIS will update the progress of your request."}
            </p>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Open → In Progress → Answered → Awaiting Customer Feedback → Closed
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${sm.cls}`}
            >
              <StatusIcon className="h-3.5 w-3.5" /> Current: {sm.label}
            </div>
            {ticket.closed_at && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Closed on {new Date(ticket.closed_at).toLocaleString()}
              </p>
            )}
            {canManageStatus && nextStatuses.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Next action
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {nextStatuses.map((s) => {
                    const meta = statusMeta[s];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={s}
                        onClick={() => updateStatus(s)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition ${meta.cls}`}
                      >
                        <Icon className="h-3.5 w-3.5" /> Move to {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(ticket.status === "closed" || ticket.status === "canceled") && (
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                This is a terminal state. A closed issue can continue through a linked follow-up.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-5">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> AI Summary
            </div>
            <p className="text-sm leading-snug">
              {ticket.description.length > 200
                ? ticket.description.slice(0, 200) + "…"
                : ticket.description}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Suggested: check the{" "}
              <Link to="/kb" className="underline">
                Knowledge Base
              </Link>{" "}
              for similar issues.
            </p>
          </div>
        </div>

        {/* Chat: fixed in place on desktop (lg:h-full inside the fixed-height flex row
            above) — only its own message list scrolls; the left column scrolls on its own. */}
        <div className="mt-6 flex h-[480px] flex-col rounded-2xl border border-border/60 bg-surface/40 backdrop-blur lg:mt-0 lg:h-full lg:w-[58%] lg:min-w-0">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <h2 className="text-sm font-semibold">Conversation</h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {realtimeStatus === "live"
                  ? "Live · realtime"
                  : realtimeStatus === "fallback"
                    ? "Connected · refresh mode"
                    : "Connecting…"}
              </span>
            </div>
            {chatError && (
              <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-xs text-destructive">
                Chat connection error: {chatError}
              </div>
            )}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                  <p className="text-sm">No messages yet.</p>
                  <p className="text-xs">Start the conversation with the MIS team below.</p>
                </div>
              ) : (
                messages.map((m) => {
                  if (isStatusChangeMessage(m.body)) {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-center text-[11px] text-muted-foreground">
                          {m.body} ·{" "}
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  }
                  const mine = m.sender_id === me;
                  const sender = messageSenders[m.sender_id];
                  const senderRole: AppRole =
                    sender?.role ??
                    (m.sender_id === ticket.user_id
                      ? "employee"
                      : m.sender_id === ticket.assignee_id
                        ? "agent"
                        : m.sender_id === me
                          ? role
                          : "admin");
                  const senderName =
                    sender?.full_name ?? sender?.email ?? (mine ? "You" : "Support user");
                  const senderRoleLabel =
                    senderRole === "admin"
                      ? "MIS Head"
                      : senderRole === "agent"
                        ? "MIS Agent"
                        : `${sender?.department ?? requester?.department ?? "Department"} Employee`;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background"
                        }`}
                      >
                        <div
                          className={`mb-1.5 flex flex-wrap items-center gap-x-2 text-[10px] ${
                            mine ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          <span className="font-bold">{senderName}</span>
                          {mine && <span>· You</span>}
                          <span
                            className={`rounded-full border px-1.5 py-0.5 font-semibold uppercase tracking-wider ${
                              mine ? "border-primary-foreground/30" : "border-border bg-muted/40"
                            }`}
                          >
                            {senderRoleLabel}
                          </span>
                        </div>
                        {m.body && (
                          <p className="whitespace-pre-wrap">{renderMessageBody(m.body, mine)}</p>
                        )}
                        {getTicketAttachments(m.attachments).length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {getTicketAttachments(m.attachments).map((attachment) => {
                              const url =
                                attachment.data_url ??
                                (attachment.path ? messageAttachmentUrls[attachment.path] : undefined);
                              const isImage = attachment.type.startsWith("image/");
                              return (
                                <a
                                  key={attachment.path ?? attachment.name}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition hover:opacity-80 ${
                                    mine
                                      ? "border-primary-foreground/25 bg-background/10"
                                      : "border-border bg-muted/30"
                                  }`}
                                >
                                  {isImage && url ? (
                                    <img
                                      src={url}
                                      alt={attachment.name}
                                      className="h-9 w-9 shrink-0 rounded object-cover"
                                    />
                                  ) : (
                                    <Paperclip className="h-4 w-4 shrink-0" />
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                                  <span className="shrink-0 opacity-70">
                                    {Math.max(1, Math.round(attachment.size / 1024))} KB
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <p
                          className={`mt-1 text-[10px] ${
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={send} className="border-t border-border/60 p-3">
              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingFiles.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                    >
                      <Paperclip className="h-3 w-3" /> {file.name}
                      <button
                        type="button"
                        onClick={() =>
                          setPendingFiles((current) => current.filter((_, i) => i !== index))
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  accept={CHAT_ATTACHMENT_TYPES.join(",")}
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-[42px] w-[42px] shrink-0"
                      aria-label="Add emoji"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="grid grid-cols-8 gap-1">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertAtCursor(emoji)}
                          className="rounded p-1.5 text-lg hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-[42px] w-[42px] shrink-0"
                      aria-label="Mention someone"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1">
                    {mentionOptions.map((option) => (
                      <button
                        key={option.tag}
                        type="button"
                        onClick={() => insertAtCursor(`${option.tag} `)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-semibold text-primary">{option.tag}</span>
                        <span className="truncate text-xs text-muted-foreground">{option.label}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-[42px] w-[42px] shrink-0"
                  aria-label="Attach a file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  rows={1}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Type a message…"
                  className="min-h-[42px] resize-none"
                  maxLength={1000}
                />
                <Button
                  type="submit"
                  disabled={sending || (!body.trim() && pendingFiles.length === 0)}
                  className="h-[42px]"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
      </div>
    </>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bot,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  User,
} from "lucide-react";
import { chatWithAssistant } from "@/lib/ai-chat";
import { summarizeChatForTicket } from "@/lib/ai-description";
import { notifyNewTicket } from "@/lib/email-notifications";
import { getCurrentUserContext } from "@/lib/current-user";
import { isPreviewMode } from "@/lib/preview-auth";
import { storePreviewTicket } from "@/lib/preview-data";
import { APP_TITLE } from "@/lib/app-meta";
import type { Database } from "@/integrations/supabase/types";

type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type ChatKind = "question" | "solution" | "escalate";
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  kind?: ChatKind;
};

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      {
        name: "description",
        content: "AI troubleshooting assistant — describe your problem and get step-by-step help.",
      },
    ],
  }),
  component: AssistantPage,
});

const GREETING: ChatMessage = {
  role: "assistant",
  kind: "question",
  content:
    "Hi! Tell me what problem you're having, and I'll ask a few questions to help figure it out.",
};

function AssistantPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const askAssistant = async (history: ChatMessage[]) => {
    setThinking(true);
    try {
      const result = await chatWithAssistant({
        data: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.message, kind: result.type },
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The assistant could not respond. Please try again.",
      );
    } finally {
      setThinking(false);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    void askAssistant(next);
  };

  const stillNotWorking = () => {
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: "That did not fix it. It's still happening." },
    ];
    setMessages(next);
    void askAssistant(next);
  };

  const resolvedByAssistant = () => {
    setMessages((current) => [
      ...current,
      { role: "user", content: "That fixed it, thank you!" },
      {
        role: "assistant",
        kind: "solution",
        content: "Glad that solved it! Come back any time you run into another issue.",
      },
    ]);
  };

  const createTicketFromChat = async () => {
    setCreatingTicket(true);
    try {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "Employee" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      const prepared = await summarizeChatForTicket({ data: { transcript } });
      const chatNote =
        "\n\n(Escalated from the AI assistant chat — MIS can see the full conversation below.)\n\n" +
        transcript;
      const description = prepared.description + chatNote;

      if (isPreviewMode()) {
        const context = await getCurrentUserContext();
        if (!context) {
          toast.error("Could not identify the employee account");
          return;
        }
        const createdAt = new Date().toISOString();
        const ticket: Ticket = {
          id: crypto.randomUUID(),
          ticket_no: `T-${String(Date.now()).slice(-6)}`,
          user_id: context.id,
          assignee_id: null,
          title: prepared.title,
          description,
          category: prepared.category,
          priority: prepared.priority,
          status: "open",
          attachments: [],
          metadata: { source: "ai_assistant_chat" },
          parent_ticket_id: null,
          follow_up_reason: null,
          closed_at: null,
          created_at: createdAt,
          updated_at: createdAt,
        };
        storePreviewTicket(ticket);
        const channel = new BroadcastChannel("mis-support-preview-ticket-updates");
        channel.postMessage(ticket);
        channel.close();
        toast.success(`${ticket.ticket_no} sent to the MIS Head Queue`);
        navigate({ to: "/tickets/$id", params: { id: ticket.id } });
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          user_id: u.user.id,
          title: prepared.title,
          description,
          category: prepared.category,
          priority: prepared.priority,
          attachments: [],
          metadata: { source: "ai_assistant_chat" },
        })
        .select("id, ticket_no")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      await supabase.from("notifications").insert({
        user_id: u.user.id,
        title: `Ticket ${data.ticket_no} created`,
        body: prepared.title,
        link: `/tickets/${data.id}`,
      });
      void notifyNewTicket({ data: { ticketId: data.id } }).catch((notifyError) =>
        console.error("Failed to send new-ticket email", notifyError),
      );
      toast.success(`Ticket ${data.ticket_no} submitted`);
      navigate({ to: "/tickets/$id", params: { id: data.id } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare a ticket from this chat.",
      );
    } finally {
      setCreatingTicket(false);
    }
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Talk it through before opening a ticket</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          AI Troubleshooting <span className="text-gradient">Assistant</span>
        </h1>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/40 backdrop-blur">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-none p-5">
          {messages.map((m, index) => (
            <div
              key={index}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[85%] items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === "user"
                      ? "bg-gradient-primary text-primary-foreground"
                      : m.kind === "solution"
                        ? "bg-success/15 text-success"
                        : m.kind === "escalate"
                          ? "bg-warning/15 text-warning"
                          : "bg-primary/10 text-primary"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : m.kind === "solution" ? (
                    <Lightbulb className="h-3.5 w-3.5" />
                  ) : m.kind === "escalate" ? (
                    <TriangleAlert className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.kind === "solution"
                        ? "border border-success/30 bg-success/10"
                        : m.kind === "escalate"
                          ? "border border-warning/30 bg-warning/10"
                          : "border border-border bg-background"
                  }`}
                >
                  {m.kind === "solution" && m.role === "assistant" && (
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-success">
                      Suggested fix
                    </p>
                  )}
                  {m.kind === "escalate" && m.role === "assistant" && (
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-warning">
                      Needs MIS
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {lastAssistantMessage?.kind === "solution" && !thinking && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-success/5 px-5 py-3">
            <span className="text-xs text-muted-foreground">Did that fix it?</span>
            <Button type="button" size="sm" variant="outline" onClick={resolvedByAssistant}>
              <ThumbsUp className="mr-2 h-3.5 w-3.5" /> Yes, fixed
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={stillNotWorking}>
              <ThumbsDown className="mr-2 h-3.5 w-3.5" /> Still not working
            </Button>
          </div>
        )}
        {lastAssistantMessage?.kind === "escalate" && !thinking && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-warning/5 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              This needs MIS to take a closer look.
            </span>
            <Button
              type="button"
              size="sm"
              disabled={creatingTicket}
              onClick={() => void createTicketFromChat()}
            >
              {creatingTicket ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              Create a ticket from this chat
            </Button>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="flex items-end gap-2 border-t border-border/60 p-3"
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Describe what's happening…"
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none"
            disabled={thinking}
          />
          <Button type="submit" size="icon" disabled={thinking || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => void createTicketFromChat()}
          disabled={creatingTicket || messages.length < 2}
          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prefer to just open a ticket with MIS instead? Create one from this chat.
        </button>
      </div>
    </div>
  );
}

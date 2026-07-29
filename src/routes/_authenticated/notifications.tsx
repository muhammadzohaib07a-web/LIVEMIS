import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Bell, Check, Loader2, Sparkles } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getCurrentUserContext } from "@/lib/current-user";
import { isPreviewMode } from "@/lib/preview-auth";
import {
  getPreviewNotifications,
  markPreviewNotificationsRead,
  PREVIEW_NOTIFICATIONS_KEY,
} from "@/lib/preview-data";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MIS Support Hub" },
      { name: "description", content: "Ticket updates and MIS announcements for employees." },
      { property: "og:title", content: "Notifications — MIS Support Hub" },
      { property: "og:description", content: "Ticket updates and announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  const broadcastPreviewChange = () => {
    const channel = new BroadcastChannel("mis-support-preview-notifications");
    channel.postMessage({ type: "read-status-updated" });
    channel.close();
  };

  const load = async () => {
    if (isPreviewMode()) {
      const context = await getCurrentUserContext();
      setPreviewUserId(context?.id ?? null);
      setItems(context ? getPreviewNotifications(context.id) : []);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (isPreviewMode()) {
      const channel = new BroadcastChannel("mis-support-preview-notifications");
      channel.onmessage = () => void load();
      const syncStorage = (event: StorageEvent) => {
        if (event.key === PREVIEW_NOTIFICATIONS_KEY) void load();
      };
      window.addEventListener("storage", syncStorage);
      return () => {
        channel.close();
        window.removeEventListener("storage", syncStorage);
      };
    }
    const channel = supabase
      .channel("my-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAll = async () => {
    const ids = items.filter((i) => !i.read).map((i) => i.id);
    if (ids.length === 0) return;
    if (isPreviewMode() && previewUserId) {
      markPreviewNotificationsRead(previewUserId, ids);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));
      broadcastPreviewChange();
      toast.success("All caught up");
      return;
    }
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    toast.success("All caught up");
  };

  const markOne = async (id: string) => {
    if (isPreviewMode() && previewUserId) {
      markPreviewNotificationsRead(previewUserId, [id]);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      broadcastPreviewChange();
      return;
    }
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Inbox</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Notifications</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAll}>
            <Check className="mr-2 h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 backdrop-blur">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
            <p className="text-xs text-muted-foreground">
              You'll see ticket updates and announcements here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const body = (
                <div
                  className={`flex items-start gap-4 px-5 py-4 ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      !n.read
                        ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                        : "bg-surface text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} onClick={() => !n.read && markOne(n.id)}>
                  {n.link ? (
                    <Link to={n.link} className="block transition hover:bg-surface/60">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

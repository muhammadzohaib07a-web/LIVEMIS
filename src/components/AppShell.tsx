import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  BookOpen,
  Bell,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Leaf,
  UsersRound,
  Settings2,
  ClipboardList,
  Wand2,
  Bot,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { disablePreviewMode, isPreviewMode } from "@/lib/preview-auth";
import { getCurrentUserContext, type AppRole } from "@/lib/current-user";
import { applyTheme, getPreferredTheme, type AppTheme } from "@/lib/theme";
import { getPreviewNotifications, PREVIEW_NOTIFICATIONS_KEY } from "@/lib/preview-data";

type Profile = {
  full_name: string | null;
  department: string | null;
  email: string | null;
};

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assignments", label: "MIS Assignment Summary", icon: ClipboardList },
  { to: "/tickets", label: "My Tickets", icon: Ticket },
  { to: "/report", label: "Report Problem", icon: PlusCircle },
  { to: "/report/wizard", label: "Smart Ticket Wizard", icon: Wand2 },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/kb", label: "Knowledge Base", icon: BookOpen },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/users", label: "User Management", icon: UsersRound },
  { to: "/settings", label: "Master Setup", icon: Settings2 },
] as const;

// The ticket detail page (chat split pane) and the Knowledge Base list want
// the full content width — every other page keeps the centered max-w-7xl
// reading width.
function usesFullWidthLayout(pathname: string) {
  return /^\/tickets\/[^/]+$/.test(pathname) || pathname === "/kb";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>("employee");
  const [theme, setTheme] = useState<AppTheme>("light");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let notificationChannel: ReturnType<typeof supabase.channel> | BroadcastChannel | null = null;
    let storageListener: ((event: StorageEvent) => void) | null = null;
    setTheme(getPreferredTheme());
    (async () => {
      const context = await getCurrentUserContext();
      if (!context) return;
      userIdRef.current = context.id;
      setRole(context.role);
      setProfile({
        full_name: context.fullName,
        department: context.department,
        email: context.email,
      });
      if (isPreviewMode()) {
        const refreshUnread = () => {
          setUnread(
            getPreviewNotifications(context.id).filter((notification) => !notification.read).length,
          );
        };
        refreshUnread();
        const previewChannel = new BroadcastChannel("mis-support-preview-notifications");
        previewChannel.onmessage = refreshUnread;
        notificationChannel = previewChannel;
        storageListener = (event) => {
          if (event.key === PREVIEW_NOTIFICATIONS_KEY) refreshUnread();
        };
        window.addEventListener("storage", storageListener);
        return;
      }
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      setUnread(count ?? 0);
      notificationChannel = supabase
        .channel(`notification-badge-${context.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${context.id}`,
          },
          () => setUnread((current) => current + 1),
        )
        .subscribe();
    })();
    return () => {
      if (storageListener) window.removeEventListener("storage", storageListener);
      if (notificationChannel instanceof BroadcastChannel) {
        notificationChannel.close();
      } else if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
      }
    };
  }, []);

  // Re-sync just the unread count on navigation (e.g. after marking notifications
  // read on /notifications) without re-fetching the profile or the realtime channel.
  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (isPreviewMode()) {
      setUnread(
        getPreviewNotifications(userId).filter((notification) => !notification.read).length,
      );
      return;
    }
    void supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [pathname]);

  const signOut = async () => {
    disablePreviewMode();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";
  const initial = firstName.charAt(0).toUpperCase();
  const THEME_ORDER: AppTheme[] = ["light", "dark", "green"];
  const toggleTheme = () => {
    const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/60 bg-surface/40 backdrop-blur lg:flex lg:flex-col">
        <SidebarInner pathname={pathname} unread={unread} role={role} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border/60 bg-background">
            <SidebarInner
              pathname={pathname}
              unread={unread}
              role={role}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <Link
              to="/notifications"
              className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-border/60 bg-surface/60 p-2 text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              aria-label={`Switch to ${
                THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
              } mode`}
              title={`Switch to ${
                THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
              } mode`}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : theme === "dark" ? (
                <Leaf className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-1.5 text-sm sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                {initial}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold">{profile?.full_name ?? firstName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {role === "admin"
                    ? "MIS Head"
                    : role === "agent"
                      ? "MIS Agent"
                      : (profile?.department ?? "Employee")}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main
          className={
            /^\/tickets\/[^/]+$/.test(pathname) || pathname === "/assistant"
              ? "mx-auto max-w-none px-4 py-4 sm:px-6 sm:py-5"
              : usesFullWidthLayout(pathname)
                ? "mx-auto max-w-none px-4 py-8 sm:px-6 sm:py-10"
                : "mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );

  function SidebarInner({
    pathname,
    unread,
    role,
    onNavigate,
  }: {
    pathname: string;
    unread: number;
    role: AppRole;
    onNavigate?: () => void;
  }) {
    const visibleNav = nav.filter((item) => {
      if (item.to === "/report" || item.to === "/report/wizard" || item.to === "/assistant")
        return role !== "admin";
      if (item.to === "/assignments" || item.to === "/users" || item.to === "/settings")
        return role === "admin";
      return true;
    });
    return (
      <>
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
          <Link to="/" onClick={onNavigate}>
            <BrandLogo size="sm" />
          </Link>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => {
            const active =
              item.to === "/dashboard" || item.to === "/report"
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.to === "/tickets" && role === "admin"
                    ? "Head Queue"
                    : item.to === "/tickets" && role === "agent"
                      ? "Assigned Tickets"
                      : item.label}
                </span>
                {item.to === "/notifications" && unread > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-background/30 text-primary-foreground"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Internal IT Helpdesk
          </p>
          <p className="text-xs font-semibold">MIS Support Hub</p>
        </div>
      </>
    );
  }
}

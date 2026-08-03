import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Ticket,
  Sparkles,
  Paperclip,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Zap,
  Clock,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import heroDashboard from "@/assets/hero-dashboard.jpg";
import { APP_TITLE } from "@/lib/app-meta";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      {
        name: "description",
        content:
          "Enterprise helpdesk for internal MIS teams. Report issues, chat live with support, track resolution, and let AI classify, summarize, and suggest fixes in real time.",
      },
      { property: "og:title", content: APP_TITLE },
      {
        property: "og:description",
        content:
          "Report, track, and resolve internal IT issues from one premium enterprise dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: MessageSquare,
    title: "Live MIS Support Chat",
    desc: "Real-time conversations with the MIS team. Typing indicators, read receipts, voice notes, and file sharing built in.",
  },
  {
    icon: Ticket,
    title: "End-to-end Issue Tracking",
    desc: "Every complaint gets a ticket number, priority, SLA, and full status history — from New to Resolved.",
  },
  {
    icon: Sparkles,
    title: "AI Triage & Assistance",
    desc: "AI auto-categorizes issues, suggests fixes before submission, and drafts resolution summaries. Every AI reply is labeled.",
  },
  {
    icon: Paperclip,
    title: "Screenshots & File Sharing",
    desc: "Attach screenshots, logs, and documents to any ticket. Secure storage with role-based access.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "First-response time, resolution time, department load, and repeat issues — exportable to Excel and PDF.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based Access",
    desc: "Admin, MIS Agent, Department Head, and Employee views. Internal notes stay internal.",
  },
];

const categories = [
  "Network",
  "Computer / Laptop",
  "Printer",
  "Software",
  "ERP / Odoo",
  "Email",
  "User Access",
  "Server",
  "Backup",
  "CCTV",
  "Attendance",
  "Other",
];

const stats = [
  { label: "Avg. first response", value: "8 min", icon: Zap },
  { label: "Tickets resolved / week", value: "1,240+", icon: CheckCircle2 },
  { label: "Avg. resolution time", value: "2.4 hrs", icon: Clock },
  { label: "Departments supported", value: "24", icon: Users },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <BrandLogo size="md" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#categories" className="transition hover:text-foreground">
              Categories
            </a>
            <a href="#analytics" className="transition hover:text-foreground">
              Analytics
            </a>
            <a href="#security" className="transition hover:text-foreground">
              Security
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Internal IT Helpdesk · AI-assisted
            </div>
            <h1 className="animate-fade-up mt-6 text-4xl font-black tracking-tight text-balance sm:text-6xl md:text-7xl">
              One Platform for Every <span className="text-gradient">Internal MIS Problem</span>
            </h1>
            <p
              className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance"
              style={{ animationDelay: "80ms" }}
            >
              Report, track, and resolve IT issues in one place. Real-time chat with the MIS team,
              AI-assisted triage, complete ticket history, and analytics — built for enterprise
              scale.
            </p>
            <div
              className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              style={{ animationDelay: "160ms" }}
            >
              <Link
                to="/auth"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90 sm:w-auto"
              >
                Report a Problem
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/50 px-6 py-3 text-base font-semibold text-foreground backdrop-blur transition hover:bg-surface sm:w-auto"
              >
                <MessageSquare className="h-4 w-4" />
                Open Support Chat
              </Link>
            </div>
          </div>

          {/* Hero dashboard preview */}
          <div
            className="animate-fade-up relative mx-auto mt-16 max-w-6xl"
            style={{ animationDelay: "240ms" }}
          >
            <div
              className="absolute inset-x-8 -top-8 h-24 bg-gradient-primary opacity-40 blur-3xl"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-elegant">
              <img
                src={heroDashboard}
                alt="MIS Support Hub enterprise dashboard preview"
                width={1600}
                height={1104}
                className="w-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
            {/* Floating stat badges */}
            <div className="pointer-events-none absolute -left-4 top-1/4 hidden animate-float rounded-xl border border-border/60 bg-surface-elevated/90 p-3 shadow-card backdrop-blur md:block">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/15">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Resolved today</div>
                  <div className="text-sm font-bold">128 tickets</div>
                </div>
              </div>
            </div>
            <div
              className="pointer-events-none absolute -right-4 top-1/3 hidden animate-float rounded-xl border border-border/60 bg-surface-elevated/90 p-3 shadow-card backdrop-blur md:block"
              style={{ animationDelay: "1.5s" }}
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">AI classified</div>
                  <div className="text-sm font-bold">98.2% accuracy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border/60 bg-surface/50 p-4 backdrop-blur"
              >
                <s.icon className="h-5 w-5 text-primary" />
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              Built for MIS teams
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run internal IT support
            </h2>
            <p className="mt-4 text-muted-foreground">
              A complete helpdesk — chat, tickets, AI, knowledge base, and analytics — designed
              specifically for internal MIS departments, not generic customer support.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-6 shadow-card transition hover:border-primary/40 hover:shadow-elegant"
              >
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-primary opacity-0 blur-3xl transition group-hover:opacity-20" />
                <div className="relative">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary/10 ring-1 ring-primary/20">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="border-t border-border/50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">
                Complete coverage
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Every kind of MIS issue, one workflow
              </h2>
              <p className="mt-4 text-muted-foreground">
                From a stuck printer to an ERP outage, employees log everything through the same
                interface. AI routes it to the right agent with the right priority.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Auto-detected category and priority via AI",
                  "Auto-generated ticket number and SLA clock",
                  "Suggested self-service fixes before submission",
                  "Duplicate-issue detection across the org",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/90">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((c, i) => (
                <div
                  key={c}
                  className="rounded-xl border border-border/60 bg-surface p-4 text-sm font-medium shadow-card transition hover:-translate-y-0.5 hover:border-primary/40"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-10 text-center shadow-elegant sm:p-16">
            <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to modernize MIS support?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Log in with your employee credentials and file your first ticket in under a minute.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-elegant transition hover:opacity-90 sm:w-auto"
                >
                  Employee sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/50 px-6 py-3 text-base font-semibold text-foreground backdrop-blur transition hover:bg-surface sm:w-auto"
                >
                  <MessageSquare className="h-4 w-4" />
                  Talk to MIS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <BrandLogo size="sm" />
            <span className="h-4 w-px bg-border" />
            <span>MIS Support Hub — Internal use only</span>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MIS Support Hub. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

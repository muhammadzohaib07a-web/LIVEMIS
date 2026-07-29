import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle, Building2, Send, ImagePlus, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { isPreviewMode } from "@/lib/preview-auth";
import { MIS_DEPARTMENT } from "@/lib/departments";
import { MIS_TICKET_CATEGORIES, type TicketCategory } from "@/lib/ticket-categories";
import { getCurrentUserContext } from "@/lib/current-user";
import { storePreviewTicket } from "@/lib/preview-data";
import { analyzeIssueScreenshot, generateIssueDescription } from "@/lib/ai-description";

type Priority = Database["public"]["Enums"]["ticket_priority"];
type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
type ScreenshotAttachment = {
  name: string;
  type: string;
  size: number;
  path?: string;
  data_url?: string;
  ai_analyzed: boolean;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read screenshot."));
    reader.onerror = () => reject(new Error("Could not read screenshot."));
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report a Problem — MIS Support Hub" },
      { name: "description", content: "Open a new IT support ticket with the MIS team." },
      { property: "og:title", content: "Report a Problem — MIS Support Hub" },
      { property: "og:description", content: "Open a new IT support ticket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const priorities: { value: Priority; label: string; tone: string }[] = [
  { value: "low", label: "Low", tone: "text-muted-foreground" },
  { value: "medium", label: "Medium", tone: "text-primary" },
  { value: "high", label: "High", tone: "text-warning" },
  { value: "urgent", label: "Urgent", tone: "text-destructive" },
];

function ReportPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("other");
  const [priority, setPriority] = useState<Priority>("medium");
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);
  const [screenshot, setScreenshot] = useState<{ file: File; dataUrl: string } | null>(null);
  const [requesterDepartment, setRequesterDepartment] = useState("Loading...");
  const generatingDescriptionRef = useRef(false);

  useEffect(() => {
    if (isPreviewMode()) {
      setRequesterDepartment("Production");
      return;
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", data.user.id)
        .maybeSingle();
      setRequesterDepartment(profile?.department ?? "Not set");
    });
  }, []);

  // Naive AI-style suggestion based on keywords
  const suggestCategory = () => {
    const t = (title + " " + description).toLowerCase();
    const rules: [TicketCategory, string[]][] = [
      ["odoo", ["odoo", "sale order", "purchase order", "inventory module", "qweb", "odoo report"]],
      ["printer", ["print", "printer", "toner"]],
      ["email", ["outlook", "mail", "inbox", "smtp"]],
      ["network", ["wifi", "wi-fi", "internet", "lan", "vpn", "network"]],
      ["server", ["server", "service down", "domain controller"]],
      ["backup", ["backup", "restore", "recovery"]],
      ["cctv", ["cctv", "camera", "nvr"]],
      ["attendance", ["attendance", "biometric", "fingerprint"]],
      ["erp", ["erp", "sap", "oracle"]],
      ["hardware", ["screen", "monitor", "mouse", "keyboard", "cpu", "pc", "laptop"]],
      ["software", ["windows", "office", "excel", "word", "install", "crash"]],
      ["access", ["access", "permission", "login", "password", "account"]],
    ];
    for (const [cat, keys] of rules) if (keys.some((k) => t.includes(k))) return cat;
    return "other" as TicketCategory;
  };

  const applySuggestion = () => {
    const s = suggestCategory();
    setCategory(s);
    toast.success(
      `AI suggested category: ${MIS_TICKET_CATEGORIES.find((c) => c.value === s)?.label}`,
    );
  };

  const writeDescriptionWithAi = async () => {
    if (generatingDescriptionRef.current) return;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 5) {
      toast.error("Please enter a clear title first");
      return;
    }
    generatingDescriptionRef.current = true;
    setGeneratingDescription(true);
    try {
      const result = await generateIssueDescription({ data: { title: cleanTitle } });
      setDescription(result.description);
      setCategory(suggestCategory());
      toast.success("AI wrote a simple four-line description");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI description could not be generated");
    } finally {
      generatingDescriptionRef.current = false;
      setGeneratingDescription(false);
    }
  };

  const generateOnTitleBlur = () => {
    if (!screenshot && !description.trim() && title.trim().length >= 5 && !generatingDescription) {
      void writeDescriptionWithAi();
    }
  };

  const analyzeScreenshot = async (dataUrl = screenshot?.dataUrl) => {
    if (!dataUrl || analyzingScreenshot) return;
    setAnalyzingScreenshot(true);
    try {
      const result = await analyzeIssueScreenshot({
        data: { title: title.trim(), imageDataUrl: dataUrl },
      });
      setDescription(result.description);
      setCategory(result.category);
      toast.success("Screenshot analyzed: description and category are ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot could not be analyzed");
    } finally {
      setAnalyzingScreenshot(false);
    }
  };

  const selectScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please select a PNG, JPEG, or WebP screenshot");
      event.target.value = "";
      return;
    }
    if (file.size > 2_500_000) {
      toast.error("Screenshot must be 2.5 MB or smaller");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setScreenshot({ file, dataUrl });
      await analyzeScreenshot(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read screenshot");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please add a title and description");
      return;
    }
    setLoading(true);
    if (isPreviewMode()) {
      const context = await getCurrentUserContext();
      if (!context) {
        setLoading(false);
        toast.error("Could not identify the employee account");
        return;
      }
      const createdAt = new Date().toISOString();
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        ticket_no: `T-${String(Date.now()).slice(-6)}`,
        user_id: context.id,
        assignee_id: null,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: "open",
        attachments: screenshot
          ? [
              {
                name: screenshot.file.name,
                type: screenshot.file.type,
                size: screenshot.file.size,
                data_url: screenshot.dataUrl,
                ai_analyzed: true,
              },
            ]
          : [],
        parent_ticket_id: null,
        follow_up_reason: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
      storePreviewTicket(ticket);
      const channel = new BroadcastChannel("mis-support-preview-ticket-updates");
      channel.postMessage(ticket);
      channel.close();
      setLoading(false);
      toast.success(`${ticket.ticket_no} sent to the MIS Head Queue`);
      navigate({ to: "/tickets/$id", params: { id: ticket.id } });
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const attachments: ScreenshotAttachment[] = [];
    if (screenshot) {
      const safeName = screenshot.file.name.replace(/[^a-z0-9._-]+/gi, "-");
      const path = `${u.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, screenshot.file, {
          contentType: screenshot.file.type,
          upsert: false,
        });
      if (uploadError) {
        setLoading(false);
        toast.error(`Screenshot upload failed: ${uploadError.message}`);
        return;
      }
      attachments.push({
        name: screenshot.file.name,
        type: screenshot.file.type,
        size: screenshot.file.size,
        path,
        ai_analyzed: true,
      });
    }
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        user_id: u.user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        attachments,
      })
      .select("id, ticket_no")
      .single();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: u.user.id,
      title: `Ticket ${data.ticket_no} created`,
      body: title.trim(),
      link: `/tickets/${data.id}`,
    });
    toast.success(`Ticket ${data.ticket_no} submitted`);
    navigate({ to: "/tickets/$id", params: { id: data.id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">New request</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Report a <span className="text-gradient">Problem</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe the issue clearly. Our AI will help route it to the right person.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-6 rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur"
        >
          <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Building2 className="h-4 w-4" /> From department
              </p>
              <p className="mt-1 font-semibold">{requesterDepartment}</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Send className="h-4 w-4" /> Send to
              </p>
              <p className="mt-1 font-semibold">{MIS_DEPARTMENT} Support Queue</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              placeholder="e.g. Outlook not syncing on desk PC"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={generateOnTitleBlur}
              maxLength={140}
            />
            <p className="text-xs text-muted-foreground">
              Leave the title field and AI will write a four-line description automatically.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="desc">Describe the issue</Label>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void writeDescriptionWithAi()}
                  disabled={generatingDescription}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generatingDescription ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Write 4 lines with AI
                </button>
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary transition hover:bg-primary/20"
                >
                  <Sparkles className="h-3 w-3" /> Suggest Category
                </button>
              </div>
            </div>
            <Textarea
              id="desc"
              required
              rows={6}
              placeholder="What happened? When did it start? Any error messages?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
            <p className="text-right text-[10px] text-muted-foreground">
              {description.length}/2000
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MIS_TICKET_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="font-medium">{c.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={`font-medium ${p.tone}`}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label htmlFor="issue-screenshot" className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  Screenshot for AI analysis
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPEG or WebP · maximum 2.5 MB
                </p>
              </div>
              {screenshot && (
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>
            {!screenshot ? (
              <label
                htmlFor="issue-screenshot"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background/50 px-4 py-7 text-center transition hover:border-primary hover:bg-primary/5"
              >
                <ImagePlus className="mb-2 h-7 w-7 text-primary" />
                <span className="text-sm font-semibold">Choose a screenshot</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Groq AI will read the error and prepare the report
                </span>
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                <img
                  src={screenshot.dataUrl}
                  alt="Selected issue screenshot"
                  className="h-28 w-full rounded-lg border border-border object-contain bg-background"
                />
                <div>
                  <p className="truncate text-sm font-semibold">{screenshot.file.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(screenshot.file.size / 1024).toFixed(0)} KB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={analyzingScreenshot}
                    onClick={() => void analyzeScreenshot()}
                  >
                    {analyzingScreenshot ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {analyzingScreenshot ? "Analyzing screenshot…" : "Analyze again"}
                  </Button>
                </div>
              </div>
            )}
            <input
              id="issue-screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => void selectScreenshot(event)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              For urgent production-line outages, also call the MIS on-call line. Tickets marked
              <span className="mx-1 font-semibold text-destructive">Urgent</span>are triaged within
              15 minutes.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || generatingDescription || analyzingScreenshot}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit ticket"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

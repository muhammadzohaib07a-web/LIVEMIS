import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { isPreviewMode } from "@/lib/preview-auth";
import {
  loadTicketCategories,
  MIS_TICKET_CATEGORIES,
  type TicketCategory,
  type TicketCategoryOption,
} from "@/lib/ticket-categories";
import { getCurrentUserContext } from "@/lib/current-user";
import { storePreviewTicket } from "@/lib/preview-data";
import { analyzeIssueScreenshot, generateIssueDescription } from "@/lib/ai-description";
import { notifyNewTicket } from "@/lib/email-notifications";
import { getModuleFields, type TicketMetadata } from "@/lib/ticket-dynamic-fields";
import { ISSUE_TYPES, getIssueType, type IssueTypeKey } from "@/lib/ticket-issue-types";

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

export const Route = createFileRoute("/_authenticated/report/wizard")({
  head: () => ({
    meta: [
      { title: "Guided Ticket Wizard — MIS Support Hub" },
      { name: "description", content: "Step-by-step, module-aware ticket reporting." },
    ],
  }),
  component: ReportWizard,
});

const priorities: { value: Priority; label: string; tone: string }[] = [
  { value: "low", label: "Low", tone: "text-muted-foreground" },
  { value: "medium", label: "Medium", tone: "text-primary" },
  { value: "high", label: "High", tone: "text-warning" },
  { value: "urgent", label: "Urgent", tone: "text-destructive" },
];

const STEPS = ["Module", "Issue Type", "Details", "Review"] as const;

function ReportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [department, setDepartment] = useState("Loading…");
  const [categories, setCategories] = useState<TicketCategoryOption[]>(MIS_TICKET_CATEGORIES);
  const [category, setCategory] = useState<TicketCategory>("other");
  const [priority, setPriority] = useState<Priority>("medium");
  const [issueType, setIssueType] = useState<IssueTypeKey | "">("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [workStopped, setWorkStopped] = useState(false);
  const [affectedUsers, setAffectedUsers] = useState(1);
  const [moduleFieldValues, setModuleFieldValues] = useState<Record<string, string>>({});
  const [screenshot, setScreenshot] = useState<{ file: File; dataUrl: string } | null>(null);

  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const moduleFields = getModuleFields(category);
  const categoryLabel = categories.find((c) => c.value === category)?.label ?? category;
  const selectedIssueType = getIssueType(issueType);

  useEffect(() => {
    if (isPreviewMode()) {
      setDepartment("Production");
      return;
    }
    void loadTicketCategories().then(setCategories);
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", data.user.id)
        .maybeSingle();
      setDepartment(profile?.department ?? "Not set");
    });
  }, []);

  const canProceed =
    step === 0
      ? Boolean(category)
      : step === 1
        ? Boolean(issueType)
        : step === 2
          ? title.trim().length > 0 && description.trim().length > 0
          : true;

  const goNext = () => {
    if (!canProceed) {
      toast.error("Please complete this step before continuing");
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const writeDescriptionWithAi = async () => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 5) {
      toast.error("Please enter a clear title first");
      return;
    }
    setGeneratingDescription(true);
    try {
      const result = await generateIssueDescription({ data: { title: cleanTitle } });
      setDescription(result.description);
      toast.success("AI wrote a simple four-line description");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI description could not be generated");
    } finally {
      setGeneratingDescription(false);
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

  const buildMetadata = (): TicketMetadata => ({
    ...(issueType ? { issueType: selectedIssueType?.label ?? issueType } : {}),
    ...(errorMessage.trim() ? { errorMessage: errorMessage.trim() } : {}),
    workStopped,
    affectedUsers,
    ...Object.fromEntries(
      moduleFields
        .map((field) => [field.key, moduleFieldValues[field.key]?.trim()])
        .filter(([, value]) => Boolean(value)),
    ),
  });

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please add a title and description");
      setStep(2);
      return;
    }
    const metadata = buildMetadata();
    setSubmitting(true);

    if (isPreviewMode()) {
      const context = await getCurrentUserContext();
      if (!context) {
        setSubmitting(false);
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
        metadata,
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
      setSubmitting(false);
      toast.success(`${ticket.ticket_no} sent to the MIS Head Queue`);
      navigate({ to: "/tickets/$id", params: { id: ticket.id } });
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSubmitting(false);
      return;
    }
    const attachments: ScreenshotAttachment[] = [];
    if (screenshot) {
      const safeName = screenshot.file.name.replace(/[^a-z0-9._-]+/gi, "-");
      const path = `${u.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, screenshot.file, { contentType: screenshot.file.type, upsert: false });
      if (uploadError) {
        setSubmitting(false);
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
        metadata,
      })
      .select("id, ticket_no")
      .single();
    setSubmitting(false);
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
    void notifyNewTicket({ data: { ticketId: data.id } }).catch((notifyError) =>
      console.error("Failed to send new-ticket email", notifyError),
    );
    toast.success(`Ticket ${data.ticket_no} submitted`);
    navigate({ to: "/tickets/$id", params: { id: data.id } });
  };

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Guided flow</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Smart Ticket <span className="text-gradient">Wizard</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Answer a few module-aware questions and MIS gets everything needed to start
            investigating right away.
          </p>
        </div>

        {/* Step tree / progress */}
        <ol className="mb-6 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  index < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === step
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`hidden text-xs font-semibold sm:inline ${
                  index <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 ${index < step ? "bg-primary" : "bg-border"}`}
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>

        <div className="space-y-6 rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur">
          {step === 0 && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Department
                  </p>
                  <p className="mt-1 font-semibold">{department}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Sends to
                  </p>
                  <p className="mt-1 font-semibold">MIS Support Queue</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Which ERP module or area is this about?</Label>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v as TicketCategory);
                    setModuleFieldValues({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
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
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Label>What kind of issue is this?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setIssueType(type.key)}
                    className={`rounded-xl border p-3 text-left transition ${
                      issueType === type.key
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{type.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{type.hint}</p>
                  </button>
                ))}
              </div>
              {selectedIssueType && (
                <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    <Workflow className="h-3.5 w-3.5" /> Expected resolution path
                  </p>
                  <ol className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    {selectedIssueType.path.map((step_, index) => (
                      <li key={step_} className="flex items-center gap-1.5">
                        <span className="rounded-full border border-border bg-background/60 px-2 py-1 font-medium text-foreground">
                          {step_}
                        </span>
                        {index < selectedIssueType.path.length - 1 && (
                          <ArrowRight className="h-3 w-3" />
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  required
                  placeholder="e.g. Manufacturing order will not close"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="desc">Describe the issue</Label>
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
                </div>
                <Textarea
                  id="desc"
                  required
                  rows={5}
                  placeholder="What happened? When did it start?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </div>

              {moduleFields.length > 0 && (
                <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Reference details for {categoryLabel}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {moduleFields.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`field-${field.key}`}
                          value={moduleFieldValues[field.key] ?? ""}
                          onChange={(e) =>
                            setModuleFieldValues((current) => ({
                              ...current,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 rounded-xl border border-border/60 bg-background/40 p-4 sm:grid-cols-[1fr_auto_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="error-message">Exact error message (if any)</Label>
                  <Input
                    id="error-message"
                    value={errorMessage}
                    onChange={(e) => setErrorMessage(e.target.value)}
                    placeholder="Copy-paste the error text"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Work stopped?</Label>
                  <div className="flex overflow-hidden rounded-md border border-input">
                    <button
                      type="button"
                      onClick={() => setWorkStopped(true)}
                      className={`px-3 py-2 text-xs font-semibold transition ${
                        workStopped
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkStopped(false)}
                      className={`px-3 py-2 text-xs font-semibold transition ${
                        !workStopped
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="affected-users">Affected users</Label>
                  <Input
                    id="affected-users"
                    type="number"
                    min={1}
                    max={9999}
                    className="w-24"
                    value={affectedUsers}
                    onChange={(e) => setAffectedUsers(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="issue-screenshot" className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-primary" /> Screenshot for AI analysis
                  </Label>
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
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background/50 px-4 py-6 text-center transition hover:border-primary hover:bg-primary/5"
                  >
                    <ImagePlus className="mb-2 h-6 w-6 text-primary" />
                    <span className="text-sm font-semibold">Choose a screenshot</span>
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
                    <img
                      src={screenshot.dataUrl}
                      alt="Selected issue screenshot"
                      className="h-24 w-full rounded-lg border border-border bg-background object-contain"
                    />
                    <div>
                      <p className="truncate text-sm font-semibold">{screenshot.file.name}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={analyzingScreenshot}
                        onClick={() => void analyzeScreenshot()}
                      >
                        {analyzingScreenshot ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {analyzingScreenshot ? "Analyzing…" : "Analyze again"}
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review everything before sending this to the MIS queue.
              </p>
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Module</p>
                  <p className="font-semibold">
                    {categoryLabel} · {priorities.find((p) => p.value === priority)?.label} priority
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Issue type
                  </p>
                  <p className="font-semibold">{selectedIssueType?.label}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Title</p>
                  <p className="font-semibold">{title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap text-foreground/90">{description}</p>
                </div>
                {(errorMessage || workStopped || moduleFields.length > 0) && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Reference details
                    </p>
                    <ul className="mt-1 space-y-1">
                      {errorMessage && (
                        <li className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Error:{" "}
                          <span className="font-medium">{errorMessage}</span>
                        </li>
                      )}
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Work stopped:{" "}
                        <span className="font-medium">{workStopped ? "Yes" : "No"}</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Affected users:{" "}
                        <span className="font-medium">{affectedUsers}</span>
                      </li>
                      {moduleFields.map(
                        (field) =>
                          moduleFieldValues[field.key]?.trim() && (
                            <li key={field.key} className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {field.label}:{" "}
                              <span className="font-medium">{moduleFieldValues[field.key]}</span>
                            </li>
                          ),
                      )}
                    </ul>
                  </div>
                )}
                {screenshot && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Attachment
                    </p>
                    <p className="font-medium">{screenshot.file.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-5">
            <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => void submit()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit ticket
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

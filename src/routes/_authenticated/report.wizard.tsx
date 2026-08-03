import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  X,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { isPreviewMode } from "@/lib/preview-auth";
import { loadTicketCategories, MIS_TICKET_CATEGORIES, type TicketCategoryOption } from "@/lib/ticket-categories";
import { getCurrentUserContext } from "@/lib/current-user";
import { storePreviewTicket } from "@/lib/preview-data";
import { interpretGuidedReport } from "@/lib/ai-description";
import { notifyNewTicket } from "@/lib/email-notifications";
import type { TicketMetadata } from "@/lib/ticket-dynamic-fields";

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
      { title: "Tell Us What Happened — MIS Support Hub" },
      { name: "description", content: "A simple, one-question-at-a-time way to report a problem." },
    ],
  }),
  component: ReportWizard,
});

const DOING_CHIPS = [
  "Entering or saving data",
  "Printing something",
  "Checking stock or a report",
  "Logging in",
  "Using a machine",
];

const WHERE_CHIPS = ["Computer / Odoo screen", "Printer", "Machine on the floor", "Internet / Wi-Fi"];

// Q0 what were you doing, Q1 where, Q2 what happened, Q3 impact, Q4 photo, Q5 review
const TOTAL_STEPS = 6;

function ReportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [whatWereYouDoing, setWhatWereYouDoing] = useState("");
  const [whereWereYouWorking, setWhereWereYouWorking] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [workStopped, setWorkStopped] = useState<boolean | null>(null);
  const [affectedUsers, setAffectedUsers] = useState(1);
  const [screenshot, setScreenshot] = useState<{ file: File; dataUrl: string } | null>(null);

  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prepared, setPrepared] = useState<{
    title: string;
    description: string;
    category: string;
    priority: Priority;
  } | null>(null);
  const [categories, setCategories] = useState<TicketCategoryOption[]>(MIS_TICKET_CATEGORIES);

  useEffect(() => {
    if (isPreviewMode()) return;
    void loadTicketCategories().then(setCategories);
  }, []);

  const canProceed =
    step === 0
      ? whatWereYouDoing.trim().length > 0
      : step === 1
        ? whereWereYouWorking.trim().length > 0
        : step === 2
          ? whatHappened.trim().length > 0
          : step === 3
            ? workStopped !== null
            : true;

  const goBack = () => {
    if (step === 5) {
      setPrepared(null);
      setStep(4);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const askAiToPrepareTicket = async () => {
    setThinking(true);
    try {
      const result = await interpretGuidedReport({
        data: {
          whatWereYouDoing: whatWereYouDoing.trim(),
          whereWereYouWorking: whereWereYouWorking.trim(),
          whatHappened: whatHappened.trim(),
          workStopped: workStopped ?? false,
          affectedUsers,
        },
      });
      setPrepared(result);
      setStep(5);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare the ticket. Please try again.",
      );
    } finally {
      setThinking(false);
    }
  };

  const goNext = () => {
    if (!canProceed) {
      toast.error("Please answer this question first");
      return;
    }
    if (step === 4) {
      void askAiToPrepareTicket();
      return;
    }
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  };

  const selectScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please select a PNG, JPEG, or WebP photo");
      event.target.value = "";
      return;
    }
    if (file.size > 2_500_000) {
      toast.error("Photo must be 2.5 MB or smaller");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setScreenshot({ file, dataUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read the photo");
    }
  };

  const submit = async () => {
    if (!prepared) return;
    setSubmitting(true);

    const metadata: TicketMetadata = {
      workStopped: workStopped ?? false,
      affectedUsers,
      whatWereYouDoing: whatWereYouDoing.trim(),
      whereWereYouWorking: whereWereYouWorking.trim(),
    };

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
        title: prepared.title,
        description: prepared.description,
        category: prepared.category,
        priority: prepared.priority,
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
        toast.error(`Photo upload failed: ${uploadError.message}`);
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
        title: prepared.title,
        description: prepared.description,
        category: prepared.category,
        priority: prepared.priority,
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
      body: prepared.title,
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Tell us what happened</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Report a <span className="text-gradient">Problem</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Just answer in your own words. We will turn it into a proper ticket for you.
          </p>
        </div>

        {/* Simple progress dots, no step names or jargon */}
        <div className="mb-6 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="space-y-6 rounded-2xl border border-border/60 bg-surface/40 p-6 backdrop-blur">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-lg font-bold">What were you trying to do?</h2>
              </div>
              <Textarea
                autoFocus
                rows={3}
                placeholder="Example: I was trying to save a new customer order"
                value={whatWereYouDoing}
                onChange={(e) => setWhatWereYouDoing(e.target.value)}
                maxLength={500}
              />
              <div className="flex flex-wrap gap-2">
                {DOING_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setWhatWereYouDoing(chip)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-lg font-bold">Where were you working?</h2>
              </div>
              <Textarea
                autoFocus
                rows={2}
                placeholder="Example: On the Odoo sales screen"
                value={whereWereYouWorking}
                onChange={(e) => setWhereWereYouWorking(e.target.value)}
                maxLength={300}
              />
              <div className="flex flex-wrap gap-2">
                {WHERE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setWhereWereYouWorking(chip)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-lg font-bold">What happened?</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                What did you see on the screen, or what stopped working? Write it just like you
                would tell a colleague.
              </p>
              <Textarea
                autoFocus
                rows={5}
                placeholder="Example: The screen showed a red error and would not let me click Save"
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value)}
                maxLength={1000}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-lg font-bold">Did this stop your work?</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWorkStopped(true)}
                  className={`rounded-xl border p-4 text-center font-semibold transition ${
                    workStopped === true
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border/60 bg-background/40 hover:border-destructive/40"
                  }`}
                >
                  Yes, I am stuck
                </button>
                <button
                  type="button"
                  onClick={() => setWorkStopped(false)}
                  className={`rounded-xl border p-4 text-center font-semibold transition ${
                    workStopped === false
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-background/40 hover:border-primary/40"
                  }`}
                >
                  No, just an issue
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">How many people does this affect?</p>
                <div className="flex gap-2">
                  {[
                    { label: "Just me", value: 1 },
                    { label: "A few people", value: 5 },
                    { label: "My whole team", value: 20 },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setAffectedUsers(option.value)}
                      className={`flex-1 rounded-xl border p-3 text-xs font-semibold transition ${
                        affectedUsers === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-background/40 hover:border-primary/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <h2 className="text-lg font-bold">Do you have a photo of the screen?</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional, but it helps MIS understand faster. You can skip this.
              </p>
              {!screenshot ? (
                <label
                  htmlFor="issue-screenshot"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background/50 px-4 py-8 text-center transition hover:border-primary hover:bg-primary/5"
                >
                  <ImagePlus className="mb-2 h-7 w-7 text-primary" />
                  <span className="text-sm font-semibold">Add a photo</span>
                </label>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                  <img
                    src={screenshot.dataUrl}
                    alt="Selected issue screenshot"
                    className="h-28 w-full rounded-lg border border-border bg-background object-contain"
                  />
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold">{screenshot.file.name}</p>
                    <button
                      type="button"
                      onClick={() => setScreenshot(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
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
          )}

          {step === 5 && prepared && (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-lg font-bold">Here is your ticket</h2>
                  <p className="text-xs text-muted-foreground">
                    We wrote this from your answers. Check it looks right, then submit.
                  </p>
                </div>
              </div>
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Title</p>
                  <p className="font-semibold">{prepared.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap text-foreground/90">{prepared.description}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Sent under (change if this looks wrong)
                  </p>
                  <Select
                    value={prepared.category}
                    onValueChange={(value) => setPrepared((p) => (p ? { ...p, category: value } : p))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {thinking && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold">Preparing your ticket…</p>
              <p className="text-xs text-muted-foreground">
                We are turning your answers into a report for MIS.
              </p>
            </div>
          )}

          {!thinking && (
            <div className="flex items-center justify-between border-t border-border/60 pt-5">
              <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {step < 5 ? (
                <Button type="button" onClick={goNext}>
                  {step === 4 ? "Prepare my ticket" : "Next"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void submit()} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit ticket
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

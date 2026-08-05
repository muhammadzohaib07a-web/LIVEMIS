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
import { APP_TITLE } from "@/lib/app-meta";
import { compressImage } from "@/lib/compress-image";

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

export const Route = createFileRoute("/_authenticated/report_/wizard")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      { name: "description", content: "A simple, one-question-at-a-time way to report a problem." },
    ],
  }),
  component: ReportWizard,
});

// What the employee was likely doing, chosen from the module/screen they
// picked in the previous step — grounded in this company's real Odoo usage,
// in plain language a non-technical factory employee would say themselves.
// Falls back to a general list for screens without a specific mapping.
const DOING_SUGGESTIONS: Record<string, string[]> = {
  Sales: [
    "Creating a new sales order",
    "Sending a quotation to a customer",
    "Confirming an order",
    "Checking an existing order",
    "Editing order quantity or price",
    "Cancelling an order",
  ],
  CRM: [
    "Creating a new lead",
    "Updating a lead or opportunity",
    "Moving a lead to the next stage",
    "Scheduling a follow-up call",
    "Converting a lead to a customer",
  ],
  Purchase: [
    "Creating a purchase order",
    "Approving a purchase order",
    "Sending an RFQ to a vendor",
    "Receiving goods against a purchase order",
    "Checking vendor pricing",
  ],
  Inventory: [
    "Checking stock levels",
    "Doing a stock transfer",
    "Checking a delivery or receipt",
    "Adjusting a stock quantity",
    "Checking where a product is stored",
  ],
  Manufacturing: [
    "Starting a new production order",
    "Checking if material is available for production",
    "Marking a production order as complete",
    "Moving material between stages (Cutting, Embroidery, Stitching, Packing)",
    "Checking a bill of materials",
    "Planning a production order",
  ],
  Quality: [
    "Recording a quality check (pass or fail)",
    "Reviewing quality check results",
    "Recording a rework quantity",
    "Checking why production is blocked",
  ],
  Accounting: [
    "Creating or checking an invoice",
    "Recording a payment",
    "Checking a report",
    "Posting a journal entry",
    "Checking a customer's balance",
  ],
  "Point of Sale": [
    "Processing a sale",
    "Closing a POS session",
    "Checking a receipt",
    "Applying a discount",
    "Opening the register",
  ],
  Barcode: ["Scanning a barcode", "Checking a scanned item", "Scanning for a stock count"],
  Contacts: ["Adding a new contact", "Updating contact information", "Searching for a contact"],
  Documents: ["Uploading a document", "Finding a document", "Sharing a document"],
  "Gate Pass": ["Creating a gate pass", "Checking a gate pass", "Approving a gate pass"],
  Attendances: ["Checking in or out", "Checking an attendance record", "Requesting leave"],
  Expenses: ["Submitting an expense", "Checking expense status", "Approving an expense"],
  Maintenance: [
    "Reporting a maintenance issue",
    "Checking the maintenance schedule",
    "Closing a maintenance request",
  ],
  Repairs: ["Logging a repair", "Checking repair status", "Updating repair details"],
  Printer: [
    "Printing a document (invoice, label, delivery note)",
    "Checking printer status or paper/ink",
  ],
  "Internet / Wi-Fi": ["Trying to connect to the internet", "Checking Wi-Fi signal"],
  "Machine on the floor": [
    "Operating a machine",
    "Starting up a machine",
    "Checking a machine's status",
  ],
};

const DEFAULT_DOING_SUGGESTIONS = [
  "Entering or saving data in a form",
  "Checking a report or dashboard",
  "Logging into Odoo",
  "Attaching or uploading a file",
  "Searching for something",
];

function getDoingSuggestions(where: string): string[] {
  return DOING_SUGGESTIONS[where] ?? DEFAULT_DOING_SUGGESTIONS;
}

// Exact Odoo app/module names installed on this company's instance, so an
// employee can point straight at the screen they were in instead of a
// vague "computer" answer. A few non-Odoo/physical options stay at the end
// for issues that aren't about a specific app screen.
const WHERE_CHIPS = [
  "Sales",
  "CRM",
  "Purchase",
  "Inventory",
  "Manufacturing",
  "Quality",
  "Accounting",
  "Point of Sale",
  "Barcode",
  "Contacts",
  "Project",
  "Planning",
  "Documents",
  "Gate Pass",
  "Attendances",
  "Expenses",
  "Maintenance",
  "Repairs",
  "PLM",
  "Sign",
  "Website",
  "Social Marketing",
  "Sales Planning",
  "Dashboards",
  "Discuss",
  "Calendar",
  "To-do",
  "Kitchen Display",
  "eStore",
  "Printer",
  "Machine on the floor",
  "Internet / Wi-Fi",
];

// Q0 where, Q1 what were you doing, Q2 what happened, Q3 impact, Q4 photo, Q5 review
const TOTAL_STEPS = 6;

// Common "what happened" phrasing for each module/screen the employee said
// they were working in, grounded in this company's real Odoo behavior.
// Falls back to a generic set for screens without a specific list.
const WHAT_HAPPENED_SUGGESTIONS: Record<string, string[]> = {
  Sales: [
    "I got an error message when confirming the order",
    "The price or quantity shown is wrong",
    "I can't find the customer",
    "The order is stuck and won't move forward",
    "The customer never received the quotation",
    "It won't let me edit the order",
  ],
  CRM: [
    "The lead/opportunity is missing or duplicated",
    "I can't move it to the next stage",
    "The information saved is wrong",
    "It won't let me schedule a follow-up",
    "The lead didn't convert to a customer",
  ],
  Purchase: [
    "I can't approve the order",
    "I got an error message when confirming",
    "The vendor or price is wrong",
    "It's stuck waiting for approval",
    "The goods received don't match the order",
  ],
  Inventory: [
    "The stock quantity shown is wrong",
    "I can't complete the transfer",
    "The transfer is stuck or not showing",
    "The stock count doesn't match what's on the shelf",
    "I can't find where the product is stored",
  ],
  Manufacturing: [
    "I can't start the production order",
    "It says material is not available",
    "The quality check is blocking me from starting",
    "The stage transfer (Cutting/Embroidery/Stitching/Packing) is missing",
    "The bill of materials looks wrong",
    "It won't let me mark it as complete",
  ],
  Quality: [
    "I can't create or pass the quality check",
    "It shows the wrong quantity",
    "It's blocking production for no reason",
    "The rework quantity isn't saving",
  ],
  Accounting: [
    "The invoice amount is wrong",
    "I can't post or confirm the invoice",
    "A payment isn't showing",
    "The customer balance looks wrong",
    "The journal entry won't save",
  ],
  "Point of Sale": [
    "The sale won't complete",
    "The wrong price or item is showing",
    "The session won't close",
    "The discount isn't applying",
    "The register won't open",
  ],
  Barcode: [
    "The scanner isn't reading the barcode",
    "It's scanning the wrong item",
    "Nothing happens when I scan",
  ],
  Printer: [
    "Nothing prints",
    "It prints blank or wrong pages",
    "It shows an offline or error message",
    "The printout is missing information",
    "It printed the wrong document",
  ],
  "Internet / Wi-Fi": [
    "The connection keeps dropping",
    "The page won't load at all",
    "It's very slow",
    "It connects but nothing works",
  ],
  "Machine on the floor": [
    "The machine won't turn on",
    "It's making an unusual noise",
    "It stopped mid-way through a job",
    "It's producing bad output",
  ],
};

const DEFAULT_WHAT_HAPPENED_SUGGESTIONS = [
  "I got an error message on the screen",
  "It froze or stopped responding",
  "Nothing happened when I tried",
  "The information shown is wrong",
  "It's much slower than usual",
];

// Extra "what happened" suggestions pulled in from keywords in the "what
// were you doing" answer, so this step reflects both previous answers
// instead of only the module picked.
const DOING_KEYWORD_HAPPENED_HINTS: { keywords: string[]; suggestions: string[] }[] = [
  {
    keywords: ["quotation", "sales order", "confirming an order", "customer"],
    suggestions: ["The customer never received it", "It won't let me confirm the order"],
  },
  {
    keywords: ["purchase", "rfq", "vendor", "approving"],
    suggestions: ["It's stuck waiting for approval", "The vendor details are wrong"],
  },
  {
    keywords: ["quality check", "quality"],
    suggestions: ["The quality check keeps failing", "I can't submit the quality check"],
  },
  {
    keywords: ["stage", "transfer", "cutting", "embroidery", "stitching", "packing"],
    suggestions: [
      "The stage transfer isn't showing as complete",
      "Material isn't moving to the next stage",
    ],
  },
  {
    keywords: ["production order", "material", "bill of materials"],
    suggestions: [
      "It says the production order is not ready",
      "The bill of materials looks wrong",
    ],
  },
  {
    keywords: ["stock", "transfer", "delivery", "receipt"],
    suggestions: ["The stock count doesn't match", "The transfer won't validate"],
  },
  {
    keywords: ["invoice", "payment", "journal"],
    suggestions: ["The invoice total is wrong", "The payment isn't linked to the invoice"],
  },
  {
    keywords: ["print"],
    suggestions: ["The printout is missing information", "It printed the wrong document"],
  },
  {
    keywords: ["barcode", "scan"],
    suggestions: ["The barcode won't scan at all", "It keeps scanning the wrong product"],
  },
  {
    keywords: ["log in", "login", "password"],
    suggestions: ["It says my password is wrong", "It won't let me in at all"],
  },
];

function getWhatHappenedSuggestions(where: string, doing: string): string[] {
  const base = WHAT_HAPPENED_SUGGESTIONS[where] ?? DEFAULT_WHAT_HAPPENED_SUGGESTIONS;
  const lowerDoing = doing.toLowerCase();
  const hints = DOING_KEYWORD_HAPPENED_HINTS.filter((entry) =>
    entry.keywords.some((keyword) => lowerDoing.includes(keyword)),
  ).flatMap((entry) => entry.suggestions);
  const extra = hints.filter((hint) => !base.includes(hint));
  return [...base, ...extra];
}

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
      ? whereWereYouWorking.trim().length > 0
      : step === 1
        ? whatWereYouDoing.trim().length > 0
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
    try {
      const compressed = await compressImage(file);
      if (compressed.size > 2_500_000) {
        toast.error("Photo must be 2.5 MB or smaller");
        event.target.value = "";
        return;
      }
      const dataUrl = await readFileAsDataUrl(compressed);
      setScreenshot({ file: compressed, dataUrl });
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

          {step === 1 && (
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
                {getDoingSuggestions(whereWereYouWorking).map((chip) => (
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
              <div className="flex flex-wrap gap-2">
                {getWhatHappenedSuggestions(whereWereYouWorking, whatWereYouDoing).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setWhatHappened(chip)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
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

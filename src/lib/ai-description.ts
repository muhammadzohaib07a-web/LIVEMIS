import { createServerFn } from "@tanstack/react-start";
import { extractJson } from "@/lib/ai-json";
import { z } from "zod";

const inputSchema = z.object({
  title: z.string().trim().min(5).max(140),
});

const screenshotInputSchema = z.object({
  title: z.string().trim().max(140),
  imageDataUrl: z
    .string()
    .max(3_600_000)
    .refine(
      (value) => /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value),
      "Only PNG, JPEG, or WebP screenshots are supported.",
    ),
});

// Kept in sync with MIS_TICKET_CATEGORIES in src/lib/ticket-categories.ts.
// Duplicated (not imported) so this server-only module never pulls in the
// client Supabase import that file also carries.
const ticketCategories = [
  "hardware",
  "printer",
  "software",
  "network",
  "email",
  "access",
  "odoo",
  "erp",
  "server",
  "backup",
  "cctv",
  "attendance",
  "other",
  "odoo-functional-support",
  "odoo-custom-development",
  "odoo-bug-fix",
  "odoo-report-development",
  "odoo-workflow-approval",
  "odoo-user-access-security",
  "odoo-api-integration",
  "odoo-performance",
  "odoo-inventory",
  "odoo-manufacturing",
  "odoo-quality",
  "odoo-purchase",
  "odoo-sales",
  "odoo-accounting",
  "odoo-warehouse",
  "textile-weaving",
  "textile-dyeing",
  "textile-finishing",
  "textile-planning",
  "textile-costing",
] as const;

const screenshotResultSchema = z.object({
  category: z.enum(ticketCategories),
  description: z.array(z.string().trim().min(1).max(220)).length(4),
});

const guidedInterviewInputSchema = z.object({
  whatWereYouDoing: z.string().trim().min(1).max(500),
  whereWereYouWorking: z.string().trim().min(1).max(300),
  whatHappened: z.string().trim().min(1).max(1000),
  workStopped: z.boolean(),
  affectedUsers: z.number().int().min(1).max(9999),
});

const guidedInterviewResultSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.array(z.string().trim().min(1).max(220)).length(4),
  category: z.enum(ticketCategories),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

const chatTranscriptInputSchema = z.object({
  transcript: z.string().trim().min(1).max(6000),
});

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export const generateIssueDescription = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI description service is not configured.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0.2,
        reasoning_effort: "low",
        max_completion_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "You write textile mill MIS support ticket descriptions. Return exactly four short lines in simple English. Use only the facts present in the title. Do not number the lines, add a heading, invent an error code, or claim troubleshooting was done.",
          },
          {
            role: "user",
            content: `Ticket title: ${data.title}`,
          },
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI service could not generate a description.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("AI returned an empty description.");
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 4);

    if (lines.length !== 4) {
      throw new Error("AI did not return four complete lines. Please try again.");
    }

    return { description: lines.join("\n") };
  });

export const analyzeIssueScreenshot = createServerFn({ method: "POST" })
  .validator(screenshotInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI screenshot service is not configured.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // The only vision-capable model on this account. It is a reasoning
        // model and rejects response_format: json_object, so its thinking is
        // hidden instead and the JSON is pulled out of the reply.
        model: "qwen/qwen3.6-27b",
        temperature: 0.1,
        max_completion_tokens: 900,
        reasoning_format: "hidden",
        messages: [
          {
            role: "system",
            content: `Analyze screenshots for a textile mill MIS helpdesk. Return JSON only with: category and description. category must be the single closest match from: ${ticketCategories.join(", ")} — prefer a specific odoo-* or textile-* value over the generic "odoo" or "other" whenever the screenshot clearly shows that module or process. description must be an array of exactly four short, simple-English lines. Mention visible application names and error text when useful. Do not invent facts. The last line may give one safe next step, but never claim the issue is already fixed.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.title
                  ? `Ticket title: ${data.title}\nAnalyze this screenshot and prepare the report.`
                  : "Analyze this screenshot and prepare the MIS support report.",
              },
              {
                type: "image_url",
                image_url: { url: data.imageDataUrl },
              },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI could not analyze the screenshot.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI returned an empty screenshot analysis.");

    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      throw new Error("AI returned an invalid screenshot analysis. Please try again.");
    }
    const result = screenshotResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI screenshot analysis was incomplete. Please try again.");
    }

    return {
      category: result.data.category,
      description: result.data.description.join("\n"),
    };
  });

// Takes plain-language answers from a simple, non-technical interview (what
// were you doing, where, what happened) and turns them into a professional
// ticket — title, four-line description, category, and priority — so the
// reporter never has to know Odoo/MIS terminology themselves.
export const interpretGuidedReport = createServerFn({ method: "POST" })
  .validator(guidedInterviewInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI interview service is not configured.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0.2,
        reasoning_effort: "low",
        max_completion_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You write professional MIS support tickets for a textile mill from a plain-language interview with a non-technical factory employee. The employee described their problem in their own words; you turn that into a clear ticket a support team can act on immediately.
Return JSON only with: title, description, category, priority.
- title: a short, specific summary (under 12 words), no jargon the employee did not imply.
- description: an array of exactly four short, simple-English lines summarizing what they were doing, where, and what went wrong. Do not invent facts beyond what was said.
- category must be the single closest match from: ${ticketCategories.join(", ")} — prefer a specific odoo-* or textile-* value over the generic "odoo" or "other" whenever the answers clearly point to that module or process.
- priority must be one of low, medium, high, urgent — base it on whether work stopped and how many people are affected (work stopped for many people = urgent or high; a minor inconvenience for one person = low).`,
          },
          {
            role: "user",
            content: `What the employee was trying to do: ${data.whatWereYouDoing}
Where they were working: ${data.whereWereYouWorking}
What happened: ${data.whatHappened}
Did work stop completely: ${data.workStopped ? "yes" : "no"}
Number of people affected: ${data.affectedUsers}`,
          },
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI could not prepare the ticket.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI returned an empty response.");

    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      throw new Error("AI returned an invalid response. Please try again.");
    }
    const result = guidedInterviewResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response was incomplete. Please try again.");
    }

    return {
      title: result.data.title,
      description: result.data.description.join("\n"),
      category: result.data.category,
      priority: result.data.priority,
    };
  });

// Turns an AI-assistant chat transcript that could not resolve the issue
// into a proper ticket (title, description, category, priority) so nothing
// discussed in the chat has to be retyped when escalating to MIS.
export const summarizeChatForTicket = createServerFn({ method: "POST" })
  .validator(chatTranscriptInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI service is not configured.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        temperature: 0.2,
        reasoning_effort: "low",
        max_completion_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You turn a support-chat transcript between an employee and an AI assistant into a professional MIS ticket for a textile mill running Odoo. The AI assistant could not resolve the issue itself, so MIS needs to take over.
Return JSON only with: title, description, category, priority.
- title: short, specific summary (under 12 words).
- description: an array of exactly four short, simple-English lines summarizing the problem and what was already tried/ruled out in the chat, so MIS does not repeat those questions.
- category must be the single closest match from: ${ticketCategories.join(", ")} — prefer a specific odoo-* or textile-* value over the generic "odoo" or "other" whenever the transcript clearly points to that module or process.
- priority must be one of low, medium, high, urgent, based on how disruptive the issue sounds.`,
          },
          { role: "user", content: data.transcript },
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI could not prepare the ticket.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI returned an empty response.");

    let parsed: unknown;
    try {
      parsed = extractJson(content);
    } catch {
      throw new Error("AI returned an invalid response. Please try again.");
    }
    const result = guidedInterviewResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response was incomplete. Please try again.");
    }

    return {
      title: result.data.title,
      description: result.data.description.join("\n"),
      category: result.data.category,
      priority: result.data.priority,
    };
  });

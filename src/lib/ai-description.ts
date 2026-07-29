import { createServerFn } from "@tanstack/react-start";
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
] as const;

const screenshotResultSchema = z.object({
  category: z.enum(ticketCategories),
  description: z.array(z.string().trim().min(1).max(220)).length(4),
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
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        max_completion_tokens: 120,
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
        model: "qwen/qwen3.6-27b",
        temperature: 0.1,
        max_completion_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Analyze screenshots for a textile mill MIS helpdesk. Return JSON only with: category and description. category must be one of hardware, printer, software, network, email, access, odoo, erp, server, backup, cctv, attendance, other. description must be an array of exactly four short, simple-English lines. Mention visible application names and error text when useful. Do not invent facts. The last line may give one safe next step, but never claim the issue is already fixed.",
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
      parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
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

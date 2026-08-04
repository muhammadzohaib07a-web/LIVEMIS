import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
});

const chatResultSchema = z.object({
  type: z.enum(["question", "solution", "escalate"]),
  message: z.string().trim().min(1).max(1500),
});

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const SYSTEM_PROMPT = `You are an expert MIS/IT support technician for a textile manufacturing company that runs Odoo ERP. An employee — often not technical — is describing a problem in a chat. Act like a skilled technician diagnosing an issue over the phone.

Rules:
1. Ask exactly ONE focused diagnostic question per turn to narrow down the root cause (what screen, what error text, when it started, what they already tried, who else is affected, etc). Never ask more than one question at a time. Keep questions short and in plain, simple English — assume the employee is not technical.
2. Once you have enough information (usually after 2-4 questions), stop asking and give a clear, numbered, step-by-step SOLUTION they can try themselves right now.
3. If the problem clearly needs an MIS/IT staff member to act directly — server access, database changes, new hardware, granting permissions, a company-wide outage — say so plainly instead of guessing, and recommend they open a support ticket.
4. Never invent facts, error codes, or menu paths you were not told. If unsure, ask rather than assume.
5. Ground answers in common issues for a textile mill running Odoo: sales/purchase orders, inventory/warehouse, manufacturing work orders, quality checks, printers, network/Wi-Fi, email/Outlook, login/access, attendance/biometric devices, CCTV, backups.

Return JSON only, no markdown, in this exact shape:
{ "type": "question" | "solution" | "escalate", "message": "..." }
- type "question": message is your single next diagnostic question.
- type "solution": message is numbered steps (use \\n between steps) they can try themselves.
- type "escalate": message briefly explains why this needs MIS/IT staff directly.`;

export const chatWithAssistant = createServerFn({ method: "POST" })
  .validator(chatInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("AI assistant is not configured.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_completion_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
      }),
    });

    const payload = (await response.json()) as GroqResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "AI assistant could not respond.");
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI assistant returned an empty response.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      throw new Error("AI assistant returned an invalid response. Please try again.");
    }
    const result = chatResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI assistant response was incomplete. Please try again.");
    }

    return result.data;
  });

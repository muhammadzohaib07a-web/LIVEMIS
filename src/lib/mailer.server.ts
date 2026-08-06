import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

// A plain-text alternative alongside the HTML body is a basic signal most
// spam filters look for; HTML-only automated mail from a personal Gmail
// account is otherwise an easy spam-folder target.
function htmlToPlainText(html: string) {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, " ")
    .replace(/&middot;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = getTransporter();
  if (!transporter) {
    console.error("[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not configured; email skipped.");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"MIS Support Hub" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
      text: htmlToPlainText(html),
    });
  } catch (error) {
    console.error(`[mailer] send to ${to} failed:`, error);
  }
}

export function emailShell(heading: string, bodyHtml: string, link: string) {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1f2e;">
      <p style="margin:0 0 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">MIS Support Hub</p>
      <h2 style="margin:0 0 16px;font-size:18px;">${heading}</h2>
      ${bodyHtml}
      <a href="${link}" style="display:inline-block;margin-top:20px;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Open in MIS Support Hub
      </a>
    </div>
  `;
}

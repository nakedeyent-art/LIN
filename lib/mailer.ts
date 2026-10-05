/**
 * Transactional email. Production uses Resend (RESEND_API_KEY + MAIL_FROM).
 * Without a key, non-production environments print the message to the server log
 * (it contains live links, so this is never done in production).
 */
export function appUrl(): string {
  const u = process.env.APP_URL;
  if (u) return u.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is not set");
  return "http://localhost:3000";
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}\n[/mail:dev]`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "LIN <onboarding@resend.dev>", to, subject, text }),
  });
  if (!res.ok) throw new Error(`mail provider responded ${res.status}`);
}

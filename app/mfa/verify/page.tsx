import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentTokenHash, requireMfaPage } from "@/lib/session";
import { mfaStatus } from "@/lib/mfa";
import { safeNext } from "@/lib/redirect";
import { logout } from "../../login/actions";
import { verifyMfa } from "../actions";

export const metadata: Metadata = { title: "Two-factor check", robots: { index: false } };

export default async function MfaVerify({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const s = await requireMfaPage();
  const { error, next } = await searchParams;
  const m = await mfaStatus(s.userId, await currentTokenHash());
  if (!m.enrolled) redirect("/mfa/setup");
  const home = s.isAdmin ? "/admin" : "/dashboard";
  if (s.isAdmin ? m.verifiedFresh : m.verifiedEver) redirect(safeNext(next, home));
  return (
    <div className="center">
      <h1>Two-factor check</h1>
      <p>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <form action={verifyMfa}>
      <input type="hidden" name="next" value={safeNext(next, home)} />
      <p><input name="code" autoComplete="one-time-code" inputMode="text" maxLength={16} placeholder="123456 or recovery code" required autoFocus /></p>
      <button className="btn" type="submit">Verify</button>
      </form>
      <p className="muted">{s.isAdmin ? "Admin pages ask again after 8 hours, and every new sign-in asks once." : "Every new sign-in asks once."}</p>
      <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
    </div>
  );
}

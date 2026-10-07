import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentTokenHash, requireAdminBasic } from "@/lib/session";
import { mfaStatus } from "@/lib/mfa";
import { safeNext } from "@/lib/redirect";
import { logout } from "../../login/actions";
import { verifyMfa } from "../actions";

export const metadata: Metadata = { title: "Two-factor check", robots: { index: false } };

export default async function MfaVerify({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const s = await requireAdminBasic();
  const { error, next } = await searchParams;
  const m = await mfaStatus(s.userId, await currentTokenHash());
  if (!m.enrolled) redirect("/mfa/setup");
  if (m.verifiedFresh) redirect(safeNext(next, "/admin"));
  return (
    <div className="center">
      <h1>Two-factor check</h1>
      <p>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <form action={verifyMfa}>
      <input type="hidden" name="next" value={safeNext(next, "/admin")} />
      <p><input name="code" autoComplete="one-time-code" inputMode="text" maxLength={16} placeholder="123456 or recovery code" required autoFocus /></p>
      <button className="btn" type="submit">Verify</button>
      </form>
      <p className="muted">Your admin session asks again after 8 hours or when you sign in on a new device.</p>
      <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentTokenHash, requireMfaPage } from "@/lib/session";
import { MFA_SENSITIVE_MINUTES, mfaStatus } from "@/lib/mfa";
import { safeNext } from "@/lib/redirect";
import { logout } from "../../login/actions";
import { verifyMfa } from "../actions";
import { beginPasskeyVerify, finishPasskeyVerify } from "../passkey-actions";
import { PasskeyVerify } from "@/components/passkey-ui";
import { hasPasskey } from "@/lib/passkeys";

export const metadata: Metadata = { title: "Two-factor check", robots: { index: false } };

export default async function MfaVerify({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; sensitive?: string }> }) {
  const s = await requireMfaPage();
  const { error, next, sensitive } = await searchParams;
  const m = await mfaStatus(s.userId, await currentTokenHash(), sensitive === "1" ? MFA_SENSITIVE_MINUTES : undefined);
  if (!m.enrolled || s.mfaReenrollmentRequired) redirect(`/mfa/setup?next=${encodeURIComponent(safeNext(next))}${sensitive === "1" ? "&sensitive=1" : ""}`);
  const home = s.isAdmin ? "/admin" : "/dashboard";
  if (s.isAdmin || sensitive === "1" ? m.verifiedFresh : m.verifiedEver) redirect(safeNext(next, home));
  const passkey = await hasPasskey(s.userId);
  return (
    <div className="center">
      <h1>Two-factor check</h1>
      <p>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
      {sensitive === "1" && <p>This action needs a recent security check. After verification, review and submit it again.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <form action={verifyMfa}>
      <input type="hidden" name="next" value={safeNext(next, home)} />
      <input type="hidden" name="sensitive" value={sensitive === "1" ? "1" : "0"} />
      <p><label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" inputMode="text" maxLength={16} placeholder="123456 or recovery code" required autoFocus /></label></p>
      <button className="btn" type="submit">Verify</button>
      </form>
      {passkey && <PasskeyVerify begin={beginPasskeyVerify} finish={finishPasskeyVerify} next={safeNext(next, home)} />}
      <p className="muted">{s.isAdmin ? "Admin pages ask again after 8 hours, and every new sign-in asks once." : "Every new sign-in asks once."}</p>
      <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
    </div>
  );
}

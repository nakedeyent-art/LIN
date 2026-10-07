import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { currentTokenHash, requireMfaPage } from "@/lib/session";
import { beginEnrollment, mfaStatus } from "@/lib/mfa";
import { groupSecret, otpauthUrl } from "@/lib/totp";
import { CodesForm } from "@/components/mfa-ui";
import { logout } from "../../login/actions";
import { enrollMfa } from "../actions";

export const metadata: Metadata = { title: "Set up two-factor authentication", robots: { index: false } };

export default async function MfaSetup() {
  const s = await requireMfaPage();
  const m = await mfaStatus(s.userId, await currentTokenHash());
  if (m.enrolled) redirect((s.isAdmin ? m.verifiedFresh : m.verifiedEver) ? (s.isAdmin ? "/admin" : "/dashboard/settings") : "/mfa/verify");
  const e = await beginEnrollment(s.userId);
  if ("error" in e) redirect("/mfa/verify");
  const qr = await QRCode.toDataURL(otpauthUrl(e.secret, s.email), { margin: 1, width: 220 });
  return (
    <div className="center">
      <h1>Set up two-factor authentication</h1>
      <p>{s.isAdmin ? "Admin accounts need a second step." : "A second step protects your account even if your password leaks."} Scan this with an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…), then enter the 6-digit code it shows.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" width={220} height={220} />
      <p className="muted">Can&apos;t scan? Enter this key by hand (time-based, 6 digits): <code data-testid="mfa-secret">{groupSecret(e.secret)}</code></p>
      <CodesForm action={enrollMfa} button="Turn on two-factor" continueHref={s.isAdmin ? "/admin" : "/dashboard/settings"} hint="You'll get one-time recovery codes next. Keep them: they're the only way back in if you lose your phone." />
      {s.isAdmin ? <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
        : <p className="muted" style={{ marginTop: 12 }}><a href="/dashboard/settings" style={{ textDecoration: "underline" }}>Not now</a></p>}
    </div>
  );
}

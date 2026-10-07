import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { currentTokenHash, requireAdminBasic } from "@/lib/session";
import { beginEnrollment, mfaStatus } from "@/lib/mfa";
import { groupSecret, otpauthUrl } from "@/lib/totp";
import { CodesForm } from "@/components/mfa-ui";
import { logout } from "../../login/actions";
import { enrollMfa } from "../actions";

export const metadata: Metadata = { title: "Set up two-factor authentication", robots: { index: false } };

export default async function MfaSetup() {
  const s = await requireAdminBasic();
  const m = await mfaStatus(s.userId, await currentTokenHash());
  if (m.enrolled) redirect(m.verifiedFresh ? "/admin" : "/mfa/verify");
  const e = await beginEnrollment(s.userId);
  if ("error" in e) redirect("/mfa/verify");
  const qr = await QRCode.toDataURL(otpauthUrl(e.secret, s.email), { margin: 1, width: 220 });
  return (
    <div className="center">
      <h1>Set up two-factor authentication</h1>
      <p>Admin accounts need a second step. Scan this with an authenticator app (Google Authenticator, 1Password, Authy, Microsoft Authenticator…), then enter the 6-digit code it shows.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" width={220} height={220} />
      <p className="muted">Can&apos;t scan? Enter this key by hand (time-based, 6 digits): <code data-testid="mfa-secret">{groupSecret(e.secret)}</code></p>
      <CodesForm action={enrollMfa} button="Turn on two-factor" continueHref="/admin" hint="You'll get one-time recovery codes next. Keep them: they're the only way back in if you lose your phone." />
      <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
    </div>
  );
}

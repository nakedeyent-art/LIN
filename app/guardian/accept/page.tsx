import Link from "next/link";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { acceptGuardianInvite } from "../actions";

export default async function AcceptPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const inv = token ? (await db().query(
    `SELECT i.guardian_email, u.full_name FROM guardian_invites i JOIN users u ON u.id = i.athlete_id
      WHERE i.token_hash=$1 AND i.status='pending' AND i.expires_at > NOW()`, [hashToken(token)])).rows[0] : null;
  const here = `/guardian/accept?token=${encodeURIComponent(token ?? "")}`;
  const s = await getSession();
  const enc = encodeURIComponent(here);

  let body;
  if (!inv) {
    body = <p className="error">{error ?? "This invite is invalid, expired or already used. Ask the athlete to send a new one."}</p>;
  } else if (!s) {
    body = <>
      <p>You&apos;ve been invited as a parent/guardian. Log in or create a <strong>Parent / Guardian</strong> account using <strong>{inv.guardian_email}</strong>.</p>
      <p><Link className="btn" href={`/login?next=${enc}`}>Log in</Link> <Link className="btn ghost" href={`/signup?next=${enc}`}>Create account</Link></p></>;
  } else if (s.role !== "parent") {
    body = <p className="error">You&apos;re logged in as {s.role}. Only a Parent / Guardian account can accept this invite.</p>;
  } else if (!s.emailVerified) {
    body = <p className="error">Verify your email first, then open this invite link again. <Link href="/verify-email" style={{ textDecoration: "underline" }}>Verify now</Link></p>;
  } else if (s.email !== inv.guardian_email) {
    body = <p className="error">This invite was sent to a different email address than the one on your account ({s.email}).</p>;
  } else {
    body = <form action={acceptGuardianInvite}>
      <input type="hidden" name="token" value={token} />
      <p><strong>{inv.full_name}</strong> has named you as their parent/guardian.</p>
      <p className="muted">By accepting you can review and approve their NIL deals and see their academic and health-plan information. You can only act for athletes who invite you.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn" type="submit">Accept as parent/guardian</button></form>;
  }
  return <div className="center"><h1>Parent / guardian invite</h1>{body}</div>;
}

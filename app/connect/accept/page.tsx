import Link from "next/link";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { acceptConnection } from "../actions";

export default async function AcceptConnection({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const inv = token ? (await db().query(
    `SELECT i.invitee_email, i.role, i.can_view_academics, i.can_view_health, a.full_name FROM connection_invites i
       JOIN users a ON a.id = i.athlete_id WHERE i.token_hash=$1 AND i.status='pending' AND i.expires_at > NOW()`, [hashToken(token)])).rows[0] : null;
  const s = await getSession();
  const enc = encodeURIComponent(`/connect/accept?token=${token ?? ""}`);
  const roleName = inv ? String(inv.role).replace("_", " ") : "";
  let body;
  if (!inv) body = <p className="error">{error ?? "This invite is invalid, expired or already used."}</p>;
  else if (!s) body = <>
    <p>You&apos;ve been invited to join an athlete&apos;s team as a <strong>{roleName}</strong>. Log in or create a {roleName} account using <strong>{inv.invitee_email}</strong>.</p>
    <p><Link className="btn" href={`/login?next=${enc}`}>Log in</Link> <Link className="btn ghost" href={`/signup?next=${enc}`}>Create account</Link></p></>;
  else if (!s.emailVerified) body = <p className="error">Verify your email first, then open this link again. <Link href="/verify-email" style={{ textDecoration: "underline" }}>Verify now</Link></p>;
  else if (s.role !== inv.role || s.email !== inv.invitee_email) body = <p className="error">This invite is for a {roleName} account with the email {inv.invitee_email}. You&apos;re signed in as a different account.</p>;
  else body = <form action={acceptConnection}>
    <input type="hidden" name="token" value={token} />
    <p><strong>{inv.full_name}</strong> invited you as their {roleName}. You&apos;ll be able to see: <strong>{[inv.can_view_academics && "academic progress", inv.can_view_health && "nutrition and training"].filter(Boolean).join(" and ")}</strong>.</p>
    <p className="muted">They can remove your access at any time. Handle this information responsibly.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="btn" type="submit">Accept</button></form>;
  return <div className="center"><h1>Team invite</h1>{body}</div>;
}

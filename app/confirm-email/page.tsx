import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { confirmEmailChange } from "./actions";

export const metadata: Metadata = { referrer: "no-referrer" };

// Shows a confirm button only; the token is spent on POST so mail scanners can't use it up.
export default async function ConfirmEmail({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const s = await getSession();
  const enc = encodeURIComponent(`/confirm-email?token=${token ?? ""}`);
  const t = token ? (await db().query(
    "SELECT user_id, payload FROM email_tokens WHERE token_hash=$1 AND purpose='change_email' AND used_at IS NULL AND expires_at > NOW()", [hashToken(token)])).rows[0] : null;
  let body;
  if (!t) body = <p className="error">{error ?? "This link is invalid, expired or already used."}</p>;
  else if (!s) body = <><p>Log in to the account you&apos;re changing, then confirm.</p><p><Link className="btn" href={`/login?next=${enc}`}>Log in</Link></p></>;
  else if (s.userId !== t.user_id) body = <p className="error">This link belongs to a different account. Log out and log in as the account that requested the change.</p>;
  else body = (
    <form action={confirmEmailChange}>
      <input type="hidden" name="token" value={token} />
      <p>Change your account email to <strong>{t.payload}</strong>?</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="btn" type="submit">Confirm new email</button>
    </form>);
  return <div className="center"><h1>Confirm your new email</h1>{body}</div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { peekResetToken } from "@/lib/verification";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { resetPassword } from "../reset/actions";

// The reset token is in the URL: never leak it to other sites via the Referer header.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const email = token ? await peekResetToken(token) : null;
  if (!email) return (
    <div className="center"><h1>Reset your password</h1>
      <p className="error">This reset link is invalid, expired or already used.</p>
      <p><Link className="btn" href="/forgot-password">Request a new link</Link></p></div>);
  return (
    <form className="center" action={resetPassword}>
      <h1>Choose a new password</h1>
      <p className="muted">For {email}. You&apos;ll be signed out everywhere after changing it.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <input type="hidden" name="token" value={token} />
      <p><input type="password" name="password" placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /></p>
      <p><input type="password" name="confirm" placeholder="Confirm new password" autoComplete="new-password" required /></p>
      <button className="btn" type="submit">Change password</button>
    </form>
  );
}

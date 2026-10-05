import Link from "next/link";
import { requestPasswordReset } from "../reset/actions";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <form className="center" action={requestPasswordReset}>
      <h1>Reset your password</h1>
      {sent ? (
        <p className="ok">If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.</p>
      ) : (
        <>
          <p className="muted">Enter your account email and we&apos;ll send you a reset link.</p>
          {error && <p role="alert" className="error">{error}</p>}
          <p><input type="email" name="email" placeholder="Email" autoComplete="email" required /></p>
          <button className="btn" type="submit">Send reset link</button>
        </>
      )}
      <p className="muted"><Link href="/login" style={{ textDecoration: "underline" }}>Back to log in</Link></p>
    </form>
  );
}

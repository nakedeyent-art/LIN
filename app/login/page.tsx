import Link from "next/link";
import { safeNext } from "@/lib/redirect";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; verified?: string; reset?: string; deleted?: string }> }) {
  const { error, next, verified, reset, deleted } = await searchParams;
  return (
    <form className="center" action={login}>
      <h1>Log in</h1>
      {verified && <p className="ok">Email confirmed. Log in to continue.</p>}
      {deleted && <p className="ok">Your account has been deleted.</p>}
      {reset && <p className="ok">Password changed. Log in with your new password.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <input type="hidden" name="next" value={safeNext(next)} />
      <p><input type="email" name="email" placeholder="Email" autoComplete="email" required /></p>
      <p><input type="password" name="password" placeholder="Password" autoComplete="current-password" required /></p>
      <button className="btn" type="submit">Log in</button>
      <p className="muted"><Link href="/forgot-password" style={{ textDecoration: "underline" }}>Forgot your password?</Link></p>
      <p className="muted">New here? <Link href={`/signup?next=${encodeURIComponent(safeNext(next))}`} style={{ textDecoration: "underline" }}>Create an account</Link></p>
    </form>
  );
}

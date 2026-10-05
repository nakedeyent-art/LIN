import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form className="center" action={login}>
      <h1>Log in</h1>
      {error && <p role="alert" className="error">{error}</p>}
      <p><input type="email" name="email" placeholder="Email" autoComplete="email" required /></p>
      <p><input type="password" name="password" placeholder="Password" autoComplete="current-password" required /></p>
      <button className="btn" type="submit">Log in</button>
      <p className="muted">New here? <Link href="/signup" style={{ textDecoration: "underline" }}>Create an account</Link></p>
    </form>
  );
}

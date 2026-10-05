import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { logout } from "../login/actions";
import { resendVerification } from "../verify/actions";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.emailVerified) redirect("/dashboard");
  const { sent, error } = await searchParams;
  return (
    <div className="center">
      <h1>Check your email</h1>
      <p>We sent a confirmation link to <strong>{s.email}</strong>. Open it to activate your account.</p>
      {sent && <p className="ok">A new link is on its way.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <form action={resendVerification}><button className="btn" type="submit">Resend email</button></form>
      <form action={logout} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Log out</button></form>
    </div>
  );
}

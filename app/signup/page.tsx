import Link from "next/link";
import { safeNext } from "@/lib/redirect";
import { ROLE_LIST } from "@/lib/roles";
import { signup } from "../login/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; verified?: string }> }) {
  const { error, next, verified } = await searchParams;
  return (
    <form className="center" action={signup}>
      <h1>Create account</h1>
      {verified && <p className="ok">Email confirmed. Log in to continue.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <input type="hidden" name="next" value={safeNext(next)} />
      <p><input type="text" name="name" placeholder="Full name" autoComplete="name" required /></p>
      <p><input type="email" name="email" placeholder="Email" autoComplete="email" required /></p>
      <p><input type="password" name="password" placeholder="Password (10+ characters)" autoComplete="new-password" minLength={10} required /></p>
      <div className="roles">
        {ROLE_LIST.map((r, i) => (
          <label key={r.id}><input type="radio" name="role" value={r.id} defaultChecked={i === 0} required />{r.label}</label>
        ))}
      </div>
      <fieldset className="extra">
        <legend>Athletes only</legend>
        <p><input type="text" name="sport" placeholder="Sport" /></p>
        <p><input type="text" name="position" placeholder="Position" /></p>
        <p><label className="muted">Birth date <input type="date" name="birth_date" /></label></p>
        <p><input type="email" name="guardian_email" placeholder="Parent/guardian email (required if under 18)" /></p>
      </fieldset>
      <fieldset className="extra">
        <legend>Managers &amp; trainers — declare your capacity</legend>
        <select name="declared_role" defaultValue="">
          <option value="">Select…</option>
          <option value="marketing_agent">Marketing Agent</option>
          <option value="certified_strength_coach">Certified Strength Coach</option>
          <option value="mentor">Mentor</option>
        </select>
        <p><input type="text" name="credential_type" placeholder="Certification (e.g. CSCS) — required for trainers and certified coaches" /></p>
      </fieldset>
      <button className="btn" type="submit">Sign up</button>
      <p className="muted">Have an account? <Link href={`/login?next=${encodeURIComponent(safeNext(next))}`} style={{ textDecoration: "underline" }}>Log in</Link></p>
    </form>
  );
}

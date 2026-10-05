import { ROLE_LIST } from "@/lib/roles";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <form className="center" action={login}>
      <h1>Log in</h1>
      <p className="muted">Demo mode: pick a role to see its dashboard. Real authentication comes next (see README).</p>
      <input type="text" name="name" placeholder="Your name" />
      <div className="roles">
        {ROLE_LIST.map((r, i) => (
          <label key={r.id}><input type="radio" name="role" value={r.id} defaultChecked={i === 0} required />{r.label}</label>
        ))}
      </div>
      <button className="btn" type="submit">Enter</button>
    </form>
  );
}

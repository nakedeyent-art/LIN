import Link from "next/link";
import { ROLE_LIST } from "@/lib/roles";

export default function Landing() {
  return (
    <div className="center">
      <h1>LIN</h1>
      <p className="tag">One NIL ecosystem for every sport and every person around the athlete. Each role gets its own dashboard.</p>
      <div className="roles">
        {ROLE_LIST.map((r) => <div key={r.id} className="card" style={{ ["--accent" as string]: r.accent }}><strong>{r.label}</strong><div className="muted">{r.tagline}</div></div>)}
      </div>
      <Link className="btn" href="/login">Log in</Link> <Link className="btn ghost" href="/signup">Sign up</Link>
    </div>
  );
}

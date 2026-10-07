"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { CodesState } from "@/lib/mfa";

export function RecoveryCodes({ codes, continueHref }: { codes: string[]; continueHref: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <h2>Save your recovery codes</h2>
      <p>If you lose your phone, each of these signs you in <strong>once</strong>. They are shown only now — store them somewhere safe (a password manager, or printed in a locked drawer).</p>
      <pre style={{ fontSize: 18, lineHeight: 1.8, userSelect: "all" }} data-testid="recovery-codes">{codes.join("\n")}</pre>
      <p><button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(codes.join("\n")).catch(() => {})}>Copy</button></p>
      <label><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I&apos;ve saved these codes</label>
      <p>{saved ? <Link className="btn" href={continueHref}>Continue</Link> : <button className="btn" disabled>Continue</button>}</p>
    </div>
  );
}

/** Enrol (password + first code) or regenerate (password + current code): both end by showing a fresh set of recovery codes. */
export function CodesForm({ action, button, continueHref, hint }: { action: (p: CodesState, f: FormData) => Promise<CodesState>; button: string; continueHref: string; hint?: string }) {
  const [state, act, pending] = useActionState(action, {} as CodesState);
  if (state.codes) return <RecoveryCodes codes={state.codes} continueHref={continueHref} />;
  return (
    <form action={act} style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="6-digit code" required />
      <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
      {state.error && <p role="alert" className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Checking…" : button}</button>
      {hint && <p className="muted">{hint}</p>}
    </form>
  );
}

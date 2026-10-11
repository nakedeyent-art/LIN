"use client";
import { useState } from "react";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/browser";

type Outcome = { ok: true } | { error: string };
const supported = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

/** Adds a passkey: asks the server for options, runs the browser ceremony, sends the result back. Nothing here is a security decision. */
export function AddPasskey({ begin, finish }: { begin: () => Promise<PublicKeyCredentialCreationOptionsJSON | { error: string }>; finish: (name: string, response: RegistrationResponseJSON) => Promise<Outcome> }) {
  const [name, setName] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setStatus("");
    try {
      const options = await begin();
      if ("error" in options) return setStatus(options.error);
      const { startRegistration } = await import("@simplewebauthn/browser");
      const response = await startRegistration({ optionsJSON: options });
      const r = await finish(name, response);
      if ("error" in r) return setStatus(r.error);
      window.location.assign(`/dashboard/settings?msg=${encodeURIComponent("Passkey added.")}`);
    } catch (e) { setStatus((e as Error).name === "NotAllowedError" ? "The passkey request was cancelled or timed out." : `Could not add the passkey: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  if (!supported()) return <p className="muted">This browser does not support passkeys.</p>;
  return <div>
    <label>Passkey name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Work laptop" /></label>
    <p><button type="button" className="btn" disabled={busy} onClick={run}>{busy ? "Waiting for your device…" : "Add a passkey"}</button></p>
    <p role="status" aria-live="polite" className={status ? "error" : "muted"}>{status}</p>
  </div>;
}

/** The second step with a passkey instead of a code. On success the server has already marked this session verified; we just move on. */
export function PasskeyVerify({ begin, finish, next }: { begin: () => Promise<PublicKeyCredentialRequestOptionsJSON | { error: string }>; finish: (response: AuthenticationResponseJSON) => Promise<Outcome>; next: string }) {
  const [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setStatus("");
    try {
      const options = await begin();
      if ("error" in options) return setStatus(options.error);
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const response = await startAuthentication({ optionsJSON: options });
      const r = await finish(response);
      if ("error" in r) return setStatus(r.error);
      window.location.assign(next);
    } catch (e) { setStatus((e as Error).name === "NotAllowedError" ? "The passkey request was cancelled or timed out. You can still enter a code." : `Passkey check failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  if (!supported()) return null;
  return <div style={{ marginTop: 12 }}>
    <button type="button" className="btn ghost" disabled={busy} onClick={run}>{busy ? "Waiting for your device…" : "Use a passkey instead"}</button>
    <p role="status" aria-live="polite" className={status ? "error" : "muted"}>{status}</p>
  </div>;
}

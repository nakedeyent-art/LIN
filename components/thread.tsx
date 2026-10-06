"use client";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import type { ViewMsg } from "@/lib/threadview";
import type { PostState } from "@/lib/messaging";
import { REASON_LABEL, REPORT_REASONS } from "@/lib/reports";
import { MAX_FILE_BYTES, MAX_FILES_PER_MESSAGE, formatBytes } from "@/lib/attachments";
import { MAX_MESSAGE_CHARS } from "@/lib/messaging";

const POLL_MS = 5000;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export function Thread({ dealId, initial, canPost, closedNote, post, report }: {
  dealId: string; initial: ViewMsg[]; canPost: boolean; closedNote: string | null;
  post: (prev: PostState, f: FormData) => Promise<PostState>; report: (f: FormData) => Promise<void>;
}) {
  const [msgs, setMsgs] = useState(initial);
  const last = useRef(initial.length ? initial[initial.length - 1].id : 0);
  const [live, setLive] = useState(true);
  const [state, action, pending] = useActionState(post, {} as PostState);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/dashboard/deals/${dealId}/messages/feed?after=${last.current}`, { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) { setLive(false); return; }
      const j = (await r.json()) as { messages: ViewMsg[] };
      setLive(true);
      if (j.messages.length) {
        last.current = Math.max(last.current, ...j.messages.map((m) => m.id));
        setMsgs((cur) => { const seen = new Set(cur.map((m) => m.id)); return [...cur, ...j.messages.filter((m) => !seen.has(m.id))]; });
      }
    } catch { setLive(false); }
  }, [dealId]);

  // Poll while the tab is visible (and once when it returns); no polling in background tabs.
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!t) t = setInterval(poll, POLL_MS); };
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    const vis = () => { if (document.visibilityState === "visible") { poll(); start(); } else stop(); };
    vis(); document.addEventListener("visibilitychange", vis);
    return () => { stop(); document.removeEventListener("visibilitychange", vis); };
  }, [poll]);

  useEffect(() => { if (state.sent) { formRef.current?.reset(); poll(); } }, [state.sent, poll]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  return (
    <>
      <ol className="thread" style={{ listStyle: "none", padding: 0 }} aria-live="polite">
        {msgs.length === 0 && <li className="muted">No messages yet.</li>}
        {msgs.map((m) => (
          <li key={m.id} style={{ marginBottom: 12 }}>
            <div><strong>{m.name}</strong> <span className="muted">· {m.role} · {fmt(m.at)}</span></div>
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontStyle: m.hidden ? "italic" : undefined }} className={m.hidden ? "muted" : undefined}>{m.body}</div>
            {m.files.length > 0 && <div>{m.files.map((f) => (
              <a key={f.id} className="btn ghost" style={{ marginRight: 6 }} href={`/dashboard/deals/${dealId}/attachments/${f.id}`} download>📎 {f.name} ({formatBytes(f.size)})</a>))}</div>}
            {m.reportable && (m.reported ? <span className="muted">Reported</span> : (
              <details>
                <summary className="muted" style={{ cursor: "pointer" }}>Report</summary>
                <form action={report} style={{ display: "grid", gap: 6, maxWidth: 380, marginTop: 6 }}>
                  <input type="hidden" name="deal_id" value={dealId} /><input type="hidden" name="message_id" value={m.id} />
                  <select name="reason" required defaultValue="">
                    <option value="" disabled>What&apos;s wrong?</option>
                    {REPORT_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
                  </select>
                  <textarea name="note" rows={2} maxLength={500} placeholder="Anything we should know? (optional)" />
                  <button className="btn ghost" type="submit">Send report</button>
                  <span className="muted">A moderator will be able to read this message and the ones around it.</span>
                </form>
              </details>))}
          </li>))}
      </ol>
      <div ref={endRef} />
      {!live && <p className="muted">Live updates paused — reconnecting. Refresh if this lasts.</p>}
      {canPost ? (
        <form ref={formRef} action={action} style={{ marginTop: 8 }}>
          <input type="hidden" name="deal_id" value={dealId} />
          <label>Message
            <textarea key={`${state.sent ?? 0}:${state.error ?? ""}`} name="body" rows={4} maxLength={MAX_MESSAGE_CHARS} required defaultValue={state.draft ?? ""} style={{ width: "100%" }} /></label>
          <label>Attach up to {MAX_FILES_PER_MESSAGE} files (PNG, JPEG or PDF, {formatBytes(MAX_FILE_BYTES)} each)
            <input type="file" name="files" multiple accept="image/png,image/jpeg,application/pdf" /></label>
          {state.error && <p role="alert" className="error">{state.error}{state.draft ? " Your text is still here; re-attach any files." : ""}</p>}
          <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
        </form>
      ) : closedNote ? <p className="muted">{closedNote}</p> : null}
    </>
  );
}

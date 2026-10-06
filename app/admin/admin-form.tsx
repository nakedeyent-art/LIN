import type { ReactNode } from "react";

/** Reason + password are required for every admin change. */
export function AdminForm({ action, hidden, button, danger, children }: {
  action: (f: FormData) => Promise<void>; hidden: Record<string, string>; button: string; danger?: boolean; children?: ReactNode;
}) {
  return (
    <form action={action} style={{ display: "grid", gap: 6, maxWidth: 420, marginBottom: 14 }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <input name="reason" placeholder="Reason (saved in the audit log)" minLength={10} maxLength={300} required autoComplete="off" />
      <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
      <button className="btn" type="submit" style={danger ? { background: "#ef4444" } : undefined}>{button}</button>
    </form>
  );
}

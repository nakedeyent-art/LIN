import { db } from "@/lib/db";
import { currentTokenHash, requireUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { DELETE_PHRASE } from "@/lib/account";
import { Badge, Card, Grid } from "@/components/ui";
import Link from "next/link";
import { CodesForm } from "@/components/mfa-ui";
import { isEnrolled, recoveryRemaining, SECURITY_LABEL, type SecurityAction } from "@/lib/mfa";
import { disableMyMfa, regenerateMyCodes } from "./mfa-actions";
import {
  cancelEmailChange, changePassword, deleteAccount, requestEmailChange, signOutOthers, updateEmailPrefs, updateProfile,
} from "./actions";

const stack = { display: "grid", gap: 8, maxWidth: 420 } as const;
const fmt = (d: Date) => new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function Settings({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireUser();
  const q = await searchParams;
  const pool = db();
  const [prefs, prof, pending, sessions] = await Promise.all([
    pool.query("SELECT email_deal_updates, email_messages FROM users WHERE id=$1", [s.userId]),
    pool.query("SELECT sport, position, state, grad_year, birth_date::text AS birth, level FROM athlete_profiles WHERE user_id=$1", [s.userId]),
    pool.query("SELECT payload, expires_at FROM email_tokens WHERE user_id=$1 AND purpose='change_email' AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [s.userId]),
    pool.query("SELECT token_hash = $2 AS current, created_at, expires_at FROM sessions WHERE user_id=$1 AND expires_at > NOW() ORDER BY created_at DESC", [s.userId, await currentTokenHash()]),
  ]);
  const pref = prefs.rows[0];
  const mfaOn = await isEnrolled(s.userId);
  const codesLeft = mfaOn ? await recoveryRemaining(s.userId) : 0;
  const events = (await pool.query("SELECT action, created_at FROM security_events WHERE user_id=$1 ORDER BY id DESC LIMIT 8", [s.userId])).rows as { action: SecurityAction; created_at: Date }[];
  const a = prof.rows[0], change = pending.rows[0];
  return (
    <>
      <h1>Account settings</h1>
      <div className="tag">{s.email} · {ROLES[s.role].label}</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Profile">
          <form action={updateProfile} style={stack}>
            <input type="text" name="name" defaultValue={s.name} placeholder="Full name" required />
            {a && <>
              <input type="text" name="sport" defaultValue={a.sport} placeholder="Sport" required />
              <input type="text" name="position" defaultValue={a.position ?? ""} placeholder="Position" />
              <input type="text" name="state" defaultValue={a.state ?? ""} placeholder="State (e.g. TX)" maxLength={2} />
              <input type="text" name="grad_year" defaultValue={a.grad_year ?? ""} placeholder="Graduation year" inputMode="numeric" />
              <p className="muted">Birth date ({a.birth}) can&apos;t be changed here because guardian rules depend on it. Contact support if it&apos;s wrong.</p></>}
            <button className="btn" type="submit">Save profile</button>
          </form>
        </Card>

        <Card title="Email address">
          <p>{s.email} <Badge tone={s.emailVerified ? "green" : "yellow"}>{s.emailVerified ? "verified" : "unverified"}</Badge></p>
          {change && <>
            <p className="ok">Waiting for you to confirm <strong>{change.payload}</strong> (link expires {fmt(change.expires_at)}).</p>
            <form action={cancelEmailChange}><button className="btn ghost" type="submit">Cancel change</button></form></>}
          <form action={requestEmailChange} style={{ ...stack, marginTop: 12 }}>
            <input type="email" name="new_email" placeholder="New email address" autoComplete="email" required />
            <input type="password" name="password" placeholder="Current password" autoComplete="current-password" required />
            <button className="btn" type="submit">Send confirmation link</button>
            <p className="muted">We&apos;ll email a link to the new address and a heads-up to this one. Invites sent to your old address won&apos;t follow you.</p>
          </form>
        </Card>

        <Card title="Password">
          <form action={changePassword} style={stack}>
            <input type="password" name="current" placeholder="Current password" autoComplete="current-password" required />
            <input type="password" name="password" placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
            <input type="password" name="confirm" placeholder="Confirm new password" autoComplete="new-password" required />
            <button className="btn" type="submit">Change password</button>
            <p className="muted">Your other devices are signed out when you change it.</p>
          </form>
        </Card>

        <Card title="Email notifications">
          <form action={updateEmailPrefs} style={stack}>
            <label><input type="checkbox" name="deal_updates" defaultChecked={pref.email_deal_updates} /> Deal and payment updates</label>
            <label><input type="checkbox" name="messages" defaultChecked={pref.email_messages} /> New messages on my deals</label>
            <button className="btn" type="submit">Save</button>
            <p className="muted">In-app notifications always appear. Security emails (verification, password and email changes, account deletion) are always sent.</p>
          </form>
        </Card>

        <Card title="Two-factor authentication" wide>
          {mfaOn ? (
            <>
              <p><Badge tone="green">On</Badge> Signing in asks for a code from your authenticator app.{" "}
                {codesLeft <= 2 ? <Badge tone={codesLeft === 0 ? "red" : "yellow"}>{codesLeft} recovery code{codesLeft === 1 ? "" : "s"} left</Badge> : <span className="muted">{codesLeft} recovery codes left.</span>}</p>
              <details><summary>New recovery codes</summary>
                <CodesForm action={regenerateMyCodes} button="Create new codes" continueHref="/dashboard/settings" hint="Enter a current code from your app. Your old recovery codes stop working." /></details>
              {s.isAdmin ? <p className="muted">Two-factor is required for admin accounts, so it can&apos;t be turned off.</p> : (
                <details style={{ marginTop: 8 }}><summary>Turn off two-factor</summary>
                  <form action={disableMyMfa} style={stack}>
                    <input name="code" placeholder="Code from your app, or a recovery code" autoComplete="one-time-code" required />
                    <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
                    <button className="btn ghost" type="submit">Turn off</button>
                  </form></details>)}
              <p className="muted">Lost your phone and your recovery codes? Contact LIN support: after checking it&apos;s you, they can remove it so you can set it up again.</p>
            </>
          ) : (
            <>
              <p><Badge tone="gray">Off</Badge> Add a second step so a leaked or guessed password isn&apos;t enough to get into your account{["sponsor", "booster", "gym_owner", "parent"].includes(s.role) ? " — worth doing, since this role approves deals and payments" : ""}.</p>
              <p><Link className="btn" href="/mfa/setup">Turn on two-factor</Link></p>
              <p className="muted">Works with any authenticator app (Google Authenticator, 1Password, Authy…). You&apos;ll get one-time recovery codes in case you lose your phone.</p>
            </>)}
          {events.length > 0 && <><h4>Recent security activity</h4><ul className="list">{events.map((e, i) => <li key={i}>{SECURITY_LABEL[e.action]} · {fmt(e.created_at)}</li>)}</ul></>}
        </Card>

        <Card title="Where you're signed in">
          <table><tbody>{sessions.rows.map((r, i) => (
            <tr key={i}><td>Started {fmt(r.created_at)}</td><td>Expires {fmt(r.expires_at)}</td><td>{r.current && <Badge tone="green">this device</Badge>}</td></tr>))}</tbody></table>
          {sessions.rows.length > 1 && <form action={signOutOthers} style={{ marginTop: 8 }}><button className="btn ghost" type="submit">Sign out all other devices</button></form>}
        </Card>

        <Card title="Your data">
          <p>Download a copy of the information tied to your account (profile, grades, meals, workouts, deals, team).</p>
          <form action="/dashboard/settings/export" method="post"><button className="btn ghost" type="submit">Download my data (JSON)</button></form>
        </Card>

        <Card title="Delete account" wide>
          <p>This permanently removes your profile, grades, study and meal logs, workouts, team connections and sign-ins, and frees your email address. <strong>It can&apos;t be undone.</strong></p>
          <p className="muted">Deals you took part in are kept for the other party&apos;s records, shown as &ldquo;Deleted user&rdquo;. You can&apos;t delete while you have open deals{s.role === "parent" ? " (or while a linked athlete has open deals)" : ""}.</p>
          <form action={deleteAccount} style={stack}>
            <input type="password" name="password" placeholder="Current password" autoComplete="current-password" required />
            <input type="text" name="confirm" placeholder={`Type ${DELETE_PHRASE} to confirm`} autoComplete="off" required />
            <button className="btn" type="submit" style={{ background: "#ef4444" }}>Delete my account</button>
          </form>
        </Card>
      </Grid>
    </>
  );
}

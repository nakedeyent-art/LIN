import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { auditView, targetOf, userForAdmin } from "@/lib/admindb";
import { canActOnUser } from "@/lib/admin";
import { Badge, Card, Grid } from "@/components/ui";
import { AdminForm } from "../../admin-form";
import { adminUserAction } from "../../actions";

const fmt = (x: Date | string) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminUser({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  const q = await searchParams;
  const u = await userForAdmin(id);
  if (!u) notFound();
  await auditView(s.userId, id);
  const t = targetOf(u);
  const can = (a: Parameters<typeof canActOnUser>[2], birth?: string) => canActOnUser(s.userId, t, a, birth).ok;
  const locked = u.locked_until && new Date(u.locked_until) > new Date();
  const hidden = (action: string) => ({ user_id: u.id, action });
  return (
    <>
      <h1>{u.full_name} {u.deleted_at ? <Badge tone="gray">deleted</Badge> : u.suspended_at ? <Badge tone="red">suspended</Badge> : <Badge tone="green">active</Badge>}</h1>
      <div className="tag"><Link href="/admin/users">← Users</Link></div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Account" wide>
          <table><tbody>
            <tr><td>Email</td><td>{u.email} {u.email_verified_at ? <Badge tone="green">verified</Badge> : <Badge tone="yellow">unverified</Badge>}</td></tr>
            <tr><td>Role</td><td>{u.role}{u.is_admin ? " (admin)" : ""}</td></tr>
            <tr><td>Created</td><td>{fmt(u.created_at)}</td></tr>
            <tr><td>Sign-in</td><td>{locked ? <Badge tone="red">locked until {fmt(u.locked_until)}</Badge> : `${u.failed_logins} recent failed attempt${u.failed_logins === 1 ? "" : "s"}`} · {u.sessions} active session{u.sessions === 1 ? "" : "s"}</td></tr>
            <tr><td>Two-factor</td><td>{u.mfa_enrolled ? <Badge tone="green">on</Badge> : <Badge tone="gray">off</Badge>}{u.is_admin ? " (required for admins)" : ""}</td></tr>
            {u.birth_date && <tr><td>Birth date</td><td>{u.birth_date}</td></tr>}
            <tr><td>Deals</td><td>{u.deals_total} total, {u.live_deals} open{u.money_in_flight ? `, ${u.money_in_flight} payment(s) in flight` : ""}</td></tr>
            {u.role === "athlete" && <tr><td>Linked guardians</td><td>{u.guardians}</td></tr>}
            {u.role === "parent" && <tr><td>Athletes guarded</td><td>{u.wards}</td></tr>}
          </tbody></table>
          <p className="muted">Admins see account and deal metadata only — never messages, grades, nutrition, training or health information.</p>
        </Card>

        {can("unlock") && (locked || u.failed_logins > 0) && <Card title="Clear lockout"><AdminForm action={adminUserAction} hidden={hidden("unlock")} button="Clear lockout" /></Card>}
        {can("resend_verification") && <Card title="Resend verification email"><AdminForm action={adminUserAction} hidden={hidden("resend_verification")} button="Resend" /></Card>}
        {can("reset_mfa") && <Card title="Remove two-factor"><p className="muted">For someone locked out of their account (lost phone and recovery codes). Verify who they are first, out of band. Signs them out everywhere and emails them.</p><AdminForm action={adminUserAction} hidden={hidden("reset_mfa")} button="Remove two-factor" danger /></Card>}
        {can("suspend") && <Card title="Suspend account"><p className="muted">Signs them out everywhere and blocks sign-in. Their deals and records are untouched.</p><AdminForm action={adminUserAction} hidden={hidden("suspend")} button="Suspend" danger /></Card>}
        {can("unsuspend") && <Card title="Restore account"><AdminForm action={adminUserAction} hidden={hidden("unsuspend")} button="Restore" /></Card>}
        {u.role === "athlete" && !u.deleted_at && !u.is_admin && u.id !== s.userId && (
          <Card title="Correct birth date">
            {u.live_deals > 0 || u.money_in_flight > 0
              ? <p className="muted">Not available while the athlete has open deals or money in flight.</p>
              : <><p className="muted">Changes who must approve their deals (under 18 → a guardian). Use only to fix a verified mistake.</p>
                <AdminForm action={adminUserAction} hidden={hidden("set_birth_date")} button="Correct birth date"><input type="date" name="birth_date" required /></AdminForm></>}
          </Card>)}
      </Grid>
    </>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { logout } from "../login/actions";
import { unreadNotificationCount } from "@/lib/notificationsdb";
import { countLabel } from "@/lib/notifications";
import { isEnrolled } from "@/lib/mfa";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const cfg = ROLES[s.role];
  const unread = await unreadNotificationCount(s.userId);
  // A gentle nudge for roles that approve deals and money; everyone can find it under Settings.
  const nudge = ["sponsor", "booster", "gym_owner", "parent"].includes(s.role) && !(await isEnrolled(s.userId));
  return (
    <div className="shell" style={{ ["--accent" as string]: cfg.accent }}>
      <aside className="side">
        <div className="brand">LIN</div>
        <span className="role-chip">{cfg.label}</span>
        <nav>{cfg.nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}<Link href="/dashboard/notifications">Notifications{unread > 0 ? ` (${countLabel(unread)})` : ""}</Link><Link href="/dashboard/settings">Settings</Link>{s.isAdmin && <Link href="/admin">Admin</Link>}</nav>
        <form action={logout} style={{ marginTop: 24 }}><button className="btn ghost" type="submit">Log out</button></form>
      </aside>
      <main className="main">{nudge && <p className="muted">🔒 Protect your account: <Link href="/mfa/setup" style={{ textDecoration: "underline" }}>turn on two-factor authentication</Link>.</p>}{children}</main>
    </div>
  );
}

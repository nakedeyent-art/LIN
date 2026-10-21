import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { logout } from "../login/actions";
import { unreadNotificationCount } from "@/lib/notificationsdb";
import { countLabel } from "@/lib/notifications";
import { isEnrolled } from "@/lib/mfa";
import { needsYou } from "@/lib/needs-you";
import { NavLink } from "@/components/nav-link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const cfg = ROLES[s.role];
  const [unread, pending] = await Promise.all([unreadNotificationCount(s.userId), needsYou(s)]);
  // A gentle nudge for roles that approve deals and money; everyone can find it under Settings.
  const nudge = ["sponsor", "booster", "gym_owner", "parent"].includes(s.role) && !(await isEnrolled(s.userId));
  const needs = pending.length;
  // Role-specific items from ROLES (Home is already in "Now"; Feed/News sit with them).
  const roleNav = cfg.nav.filter((n) => n.href !== "/dashboard");
  return (
    <div className="shell" style={{ ["--accent" as string]: cfg.accent }}>
      <aside className="side">
        <div className="brand"><span className="brand-mark" aria-hidden>L</span>LIN</div>
        <span className="role-chip">{cfg.label}</span>
        <div className="rail-scroll">
          <div>
            <p className="rail-group-title" id="rail-now">Now</p>
            <nav aria-labelledby="rail-now">
              <NavLink href="/dashboard/today">Today{needs > 0 && <span className="count-pill needs" aria-label={`${needs} need${needs === 1 ? "s" : ""} you`}>{needs}</span>}</NavLink>
              <NavLink href="/dashboard">Home</NavLink>
              <NavLink href="/dashboard/notifications">Notifications{unread > 0 ? ` (${countLabel(unread)})` : ""}</NavLink>
            </nav>
          </div>
          <div>
            <p className="rail-group-title" id="rail-records">Records</p>
            <nav aria-labelledby="rail-records">
              <NavLink href="/dashboard/operations">Athlete operations</NavLink>
              <NavLink href="/dashboard/documents">Documents</NavLink>
              <NavLink href="/dashboard/signing">Forg3 signing</NavLink>
              <NavLink href="/dashboard/schedule">Schedule</NavLink>
              <NavLink href="/dashboard/tasks">Tasks &amp; expenses</NavLink>
              {s.role === "recruiter" && <NavLink href="/dashboard/scouting">Scouting</NavLink>}
            </nav>
          </div>
          <div>
            <p className="rail-group-title" id="rail-role">{cfg.label}</p>
            <nav aria-labelledby="rail-role">{roleNav.map((n) => <NavLink key={n.href} href={n.href}>{n.label}</NavLink>)}</nav>
          </div>
          <div>
            <p className="rail-group-title" id="rail-account">Account</p>
            <nav aria-labelledby="rail-account">
              <NavLink href="/dashboard/organizations">Organizations</NavLink>
              <NavLink href="/dashboard/settings">Settings</NavLink>
              {s.isAdmin && <NavLink href="/admin">Admin</NavLink>}
            </nav>
          </div>
        </div>
        <form action={logout} className="rail-foot"><button className="btn ghost" type="submit">Log out</button></form>
      </aside>
      <main className="main">{nudge && <p className="nudge"><span aria-hidden>🔒</span><span>Protect your account: <Link href="/mfa/setup">turn on two-factor authentication</Link>.</span></p>}{children}</main>
      <nav className="mobile-primary" aria-label="Mobile navigation">
        <NavLink href="/dashboard/today">Today{needs > 0 && <span className="count-pill needs" aria-hidden>{needs}</span>}</NavLink>
        <NavLink href="/dashboard/documents">Documents</NavLink>
        <NavLink href="/dashboard/deals">Messages</NavLink>
        <NavLink href="/dashboard/signing">Signatures</NavLink>
      </nav>
    </div>
  );
}

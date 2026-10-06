import Link from "next/link";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  return (
    <div className="shell" style={{ ["--accent" as string]: "#64748b" }}>
      <aside className="side">
        <div className="brand">LIN</div>
        <span className="role-chip">Admin</span>
        <nav>
          <Link href="/admin">Overview</Link><Link href="/admin/users">Users</Link><Link href="/admin/deals">Deals</Link><Link href="/admin/reports">Message reports</Link><Link href="/admin/content-reports">Post reports</Link><Link href="/admin/news">News</Link>
          <Link href="/admin/jobs">Jobs</Link><Link href="/admin/audit">Audit log</Link><Link href="/dashboard">← My dashboard</Link>
        </nav>
        <p className="muted" style={{ marginTop: 16 }}>{s.email}</p>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

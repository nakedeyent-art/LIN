import { getSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { RoleDashboard } from "@/components/dashboards";

export default async function DashboardHome() {
  const s = (await getSession())!;
  const cfg = ROLES[s.role];
  return (
    <>
      <h1>Welcome, {s.name}</h1>
      <div className="tag">{cfg.tagline}</div>
      <RoleDashboard role={s.role} />
    </>
  );
}

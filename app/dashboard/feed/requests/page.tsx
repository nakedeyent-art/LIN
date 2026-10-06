import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { followersForGuardian } from "@/lib/socialdb";
import { Badge, Card } from "@/components/ui";
import { ROLES } from "@/lib/roles";
import { decideFollow } from "../actions";

export const metadata: Metadata = { title: "Follow requests" };

export default async function Requests({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/feed");
  const q = await searchParams;
  const rows = await followersForGuardian(s.userId);
  const btn = (r: (typeof rows)[number], act: string, label: string, ghost = true) => (
    <form action={decideFollow} style={{ display: "inline", marginRight: 6 }}>
      <input type="hidden" name="athlete_id" value={r.athlete_id} /><input type="hidden" name="follower_id" value={r.follower_id} /><input type="hidden" name="act" value={act} />
      <button className={`btn${ghost ? " ghost" : ""}`} type="submit">{label}</button></form>);
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Follow requests</h1>
      <div className="tag"><Link href="/dashboard/feed">← Feed</Link> · You decide who can follow an athlete under 18 and see their posts.</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Card title={`${rows.length} request${rows.length === 1 ? "" : "s"} and follower${rows.length === 1 ? "" : "s"}`} wide>
        {rows.length === 0 ? <p className="muted">Nobody has asked to follow your athlete.</p> : (
          <ul style={{ listStyle: "none", padding: 0 }}>{rows.map((r) => (
            <li key={`${r.athlete_id}:${r.follower_id}`} style={{ marginBottom: 12 }}>
              <div><strong>{r.follower_name}</strong> <span className="muted">({ROLES[r.follower_role as keyof typeof ROLES]?.label ?? r.follower_role}) → {r.athlete_name}</span> {r.status === "pending" ? <Badge tone="yellow">waiting</Badge> : <Badge tone="green">follows</Badge>}</div>
              <div><Link href={`/dashboard/feed/u/${r.follower_id}`}>View profile</Link></div>
              <div>{r.status === "pending" ? <>{btn(r, "approve", "Approve", false)}{btn(r, "deny", "Decline")}</> : btn(r, "remove", "Remove follower")}</div>
            </li>))}</ul>)}
      </Card>
    </div>
  );
}

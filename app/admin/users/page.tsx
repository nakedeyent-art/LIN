import Link from "next/link";
import { searchUsers } from "@/lib/admindb";
import { Badge, Card } from "@/components/ui";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const hits = await searchUsers(q);
  return (
    <>
      <h1>Users</h1>
      <form style={{ display: "flex", gap: 8, marginBottom: 12 }}><input name="q" defaultValue={q} placeholder="Email or name (2+ characters)" style={{ flex: 1, maxWidth: 360 }} /><button className="btn" type="submit">Search</button></form>
      <Card title={q.trim().length >= 2 ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : "Search for an account"} wide>
        {hits.length > 0 && <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>State</th></tr></thead><tbody>{hits.map((u) => (
          <tr key={u.id}><td><Link href={`/admin/users/${u.id}`} style={{ textDecoration: "underline" }}>{u.full_name}</Link></td><td>{u.email}</td><td>{u.role}</td>
            <td>{u.deleted ? <Badge tone="gray">deleted</Badge> : u.suspended ? <Badge tone="red">suspended</Badge> : u.verified ? <Badge tone="green">active</Badge> : <Badge tone="yellow">unverified</Badge>}{u.is_admin ? <> <Badge tone="gray">admin</Badge></> : null}</td></tr>))}</tbody></table>}
        {q.trim().length >= 2 && hits.length === 50 && <p className="muted">Showing the first 50 — narrow your search.</p>}
      </Card>
    </>
  );
}

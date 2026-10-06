import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { Card } from "@/components/ui";
import { cleanQuery, excerpt, MAX_QUERY, queryOk } from "@/lib/search";
import { searchDeals, searchMessages } from "@/lib/searchdb";
import { displayName, STATUS_LABEL, type DealStatus } from "@/lib/deals";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Search deals" };
const fmt = (x: Date) => new Date(x).toLocaleDateString("en-US", { dateStyle: "medium" });

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireAccess("/dashboard/deals");
  const q = cleanQuery((await searchParams).q ?? "");
  const ok = queryOk(q);
  const [deals, msgs] = ok ? await Promise.all([searchDeals(s.userId, q), searchMessages(s.userId, q)]) : [[], []];
  // Names as the viewer may see them: a minor is "First L." to everyone but themselves and their guardians.
  const guarded = new Set((await db().query("SELECT athlete_id FROM guardian_links WHERE member_id=$1", [s.userId])).rows.map((r) => r.athlete_id as string));
  const who = (h: { athlete_id: string; athlete_name: string; athlete_minor: boolean }) =>
    h.athlete_id === s.userId || guarded.has(h.athlete_id) ? h.athlete_name : displayName(h.athlete_name, h.athlete_minor);
  return (
    <>
      <h1>Search</h1>
      <div className="tag"><Link href="/dashboard/deals">← Deals</Link> · Searches your own deals and conversations only.</div>
      <form method="get" style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input type="search" name="q" defaultValue={q} maxLength={MAX_QUERY} placeholder="Deal, person or words in a message" style={{ flex: 1, maxWidth: 420 }} />
        <button className="btn" type="submit">Search</button>
      </form>
      {q && !ok && <p className="muted">Type at least 2 characters.</p>}
      {ok && (
        <>
          <Card title={`Deals (${deals.length})`} wide>
            {deals.length === 0 ? <p className="muted">No deals match.</p> : <ul className="list">{deals.map((d) => (
              <li key={d.id}><Link href={`/dashboard/deals/${d.id}`} style={{ textDecoration: "underline" }}>{d.title}</Link> <span className="muted">· {d.counterparty_name} → {who(d)} · {STATUS_LABEL[d.status as DealStatus]}</span></li>))}</ul>}
          </Card>
          <Card title={`Messages (${msgs.length}${msgs.length === 30 ? "+" : ""})`} wide>
            {msgs.length === 0 ? <p className="muted">No messages match.</p> : <ul className="list">{msgs.map((m) => (
              <li key={m.message_id}>
                <Link href={`/dashboard/deals/${m.id}/messages`} style={{ textDecoration: "underline" }}>{m.title}</Link> <span className="muted">· {fmt(m.created_at)}</span>
                <div style={{ overflowWrap: "anywhere" }}>{excerpt(m.body, q)}</div>
              </li>))}</ul>}
            <p className="muted">Tip: use &quot;quotes&quot; for an exact phrase, or <code>-word</code> to leave a word out. Removed messages don&apos;t appear.</p>
          </Card>
        </>)}
    </>
  );
}

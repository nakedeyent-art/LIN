import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { CATEGORIES, CATEGORY_LABEL, isEmptyFilter, LEVELS, LEVEL_LABEL, parseFilter, SPORTS, type Category, type NewsLevel } from "@/lib/news";
import { getPrefs, listNews, MAX_PAGE, todayCount } from "@/lib/newsdb";
import { Badge, Card, Disclaimer } from "@/components/ui";
import { clearNewsFilters, saveNewsFilters } from "./actions";

export const metadata: Metadata = { title: "News" };
const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function NewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("/dashboard/news");
  const sp = await searchParams;
  const get = (k: string) => { const v = sp[k]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; };
  const filterKeys = ["cat", "level", "sport", "q", "days"];
  const explicit = filterKeys.some((k) => sp[k] !== undefined) || sp.all !== undefined;
  const saved = explicit ? null : await getPrefs(s.userId);
  const f = saved ?? parseFilter(get);
  const page = Math.min(Math.max(Number(get("page")[0]) || 1, 1), MAX_PAGE);
  const [{ items, more }, today] = await Promise.all([listNews(f, page), todayCount()]);
  const qs = (p: number) => { const u = new URLSearchParams(); f.categories.forEach((c) => u.append("cat", c)); f.levels.forEach((l) => u.append("level", l)); f.sports.forEach((x) => u.append("sport", x)); if (f.q) u.set("q", f.q); u.set("days", String(f.days)); u.set("page", String(p)); return u.toString(); };
  const chk = (name: string, v: string, on: boolean, label: string) => <label key={v} style={{ marginRight: 12, display: "inline-block" }}><input type="checkbox" name={name} value={v} defaultChecked={on} /> {label}</label>;

  return (
    <>
      <h1>News</h1>
      <div className="tag">High school and college sports: rankings, reclassifications, graduating seniors, redshirts and powerhouse programs. {today} new in the last 24 hours.</div>
      {sp.saved && <p className="ok">Saved. These filters are now your default.</p>}
      <Card title="Filter" wide>
        {saved && <p className="muted">Showing your saved filters. Change anything and press Apply to look elsewhere.</p>}
        <form method="get" style={{ display: "grid", gap: 8 }}>
          <div><strong>Topic</strong><br />{CATEGORIES.map((c) => chk("cat", c, f.categories.includes(c as Category), CATEGORY_LABEL[c]))}</div>
          <div><strong>Level</strong><br />{LEVELS.map((l) => chk("level", l, f.levels.includes(l as NewsLevel), LEVEL_LABEL[l]))}</div>
          <div><strong>Sport</strong><br />{SPORTS.map((x) => chk("sport", x, f.sports.includes(x), cap(x)))}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select name="days" defaultValue={String(f.days)}><option value="1">Today</option><option value="7">This week</option><option value="30">Last 30 days</option></select>
            <input type="search" name="q" defaultValue={f.q} maxLength={80} placeholder="Search headlines" />
            <button className="btn" type="submit">Apply</button>
            <button className="btn ghost" type="submit" formAction={saveNewsFilters} formMethod="post">Save as my default</button>
            <Link className="btn ghost" href="/dashboard/news?all=1">Show everything</Link>
          </div>
        </form>
        {!isEmptyFilter(f) && !saved && <form action={clearNewsFilters}><button className="btn ghost" type="submit" style={{ marginTop: 6 }}>Forget my saved filters</button></form>}
      </Card>
      <Card title={`${items.length}${more ? "+" : ""} stor${items.length === 1 ? "y" : "ies"}`} wide>
        {items.length === 0 ? <p className="muted">Nothing matches. Try widening the filters — or no news sources have been set up yet.</p> : (
          <ul style={{ listStyle: "none", padding: 0 }}>{items.map((n) => (
            <li key={n.id} style={{ marginBottom: 14 }}>
              <div>{n.url.startsWith("lin:") ? <strong>{n.title}</strong> : <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" style={{ textDecoration: "underline" }}><strong>{n.title}</strong></a>}</div>
              <div className="muted">{n.source_name} · {fmt(n.published_at)}{n.level ? ` · ${LEVEL_LABEL[n.level as NewsLevel]}` : ""}{n.sport ? ` · ${cap(n.sport)}` : ""}</div>
              {n.summary && <div>{n.summary}</div>}
              <div>{n.categories.filter((c) => c !== "general").map((c) => <span key={c}><Badge tone="gray">{CATEGORY_LABEL[c as Category] ?? c}</Badge> </span>)}</div>
            </li>))}</ul>)}
        <p>{page > 1 && <Link className="btn ghost" href={`/dashboard/news?${qs(page - 1)}`}>← Newer</Link>} {more && page < MAX_PAGE && <Link className="btn ghost" href={`/dashboard/news?${qs(page + 1)}`}>Older →</Link>}</p>
      </Card>
      <Disclaimer>Headlines and short excerpts come from third-party sources and link to the original story. LIN doesn&apos;t write or verify them, and rankings are the publishers&apos; opinions.</Disclaimer>
    </>
  );
}

import { db } from "@/lib/db";
import { Badge, Card, Grid } from "@/components/ui";
import { AdminForm } from "../admin-form";
import { addNewsSource, postEditorial, setItemHidden, sourceAction } from "../news-actions";
import { CATEGORIES, CATEGORY_LABEL, LEVELS, LEVEL_LABEL, SPORTS } from "@/lib/news";

const fmt = (x: Date | null) => (x ? new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "never");

export default async function AdminNews({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const q = await searchParams;
  const sources = (await db().query(
    `SELECT s.*, (SELECT count(*)::int FROM news_items i WHERE i.source_id = s.id) AS items FROM news_sources s ORDER BY s.name`)).rows;
  const items = (await db().query(
    "SELECT id, title, source_name, published_at, categories, hidden_at FROM news_items ORDER BY published_at DESC LIMIT 30")).rows;
  return (
    <>
      <h1>News</h1>
      <div className="tag">Only add feeds you have the right to display. LIN stores the headline, a short excerpt and a link back — never full articles.</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Sources" wide>
          {sources.length === 0 ? <p className="muted">No sources yet. Add an RSS or Atom feed below.</p> : sources.map((s) => (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <p><strong>{s.name}</strong> {s.active ? <Badge tone="green">active</Badge> : <Badge tone="red">off</Badge>} <span className="muted">{s.feed_url} · {s.items} stories · last fetch {fmt(s.last_fetched_at)}: {s.last_status ?? "—"}{s.failures ? ` (${s.failures} failure${s.failures > 1 ? "s" : ""} in a row)` : ""}</span></p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <AdminForm action={sourceAction} hidden={{ source_id: s.id, act: "fetch" }} button="Fetch now" />
                <AdminForm action={sourceAction} hidden={{ source_id: s.id, act: s.active ? "disable" : "enable" }} button={s.active ? "Turn off" : "Turn on"} danger={s.active} />
              </div>
            </div>))}
        </Card>
        <Card title="Add a source">
          <AdminForm action={addNewsSource} hidden={{}} button="Add and fetch">
            <input name="name" placeholder="Name (e.g. City Prep Report)" maxLength={80} required />
            <input name="feed_url" placeholder="https://example.com/feed.xml" required />
            <select name="default_level" defaultValue=""><option value="">Level: detect from text</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
            <select name="default_sport" defaultValue=""><option value="">Sport: detect from text</option>{SPORTS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          </AdminForm>
        </Card>
        <Card title="Post an editorial item">
          <AdminForm action={postEditorial} hidden={{}} button="Post">
            <input name="title" placeholder="Headline" maxLength={200} required />
            <textarea name="summary" rows={3} maxLength={300} placeholder="Short summary (optional)" />
            <div>{CATEGORIES.map((c) => <label key={c} style={{ display: "block" }}><input type="checkbox" name="cat" value={c} /> {CATEGORY_LABEL[c]}</label>)}</div>
            <select name="level" defaultValue=""><option value="">Level: any</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
            <select name="sport" defaultValue=""><option value="">Sport: any</option>{SPORTS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          </AdminForm>
        </Card>
        <Card title="Latest stories (hide anything inappropriate)" wide>
          {items.map((i) => (
            <details key={i.id} style={{ marginBottom: 6 }}>
              <summary>{i.hidden_at ? <Badge tone="red">hidden</Badge> : null} {i.title} <span className="muted">· {i.source_name} · {fmt(i.published_at)}</span></summary>
              <AdminForm action={setItemHidden} hidden={{ item_id: i.id, hide: i.hidden_at ? "0" : "1" }} button={i.hidden_at ? "Restore" : "Hide"} danger={!i.hidden_at} />
            </details>))}
        </Card>
      </Grid>
    </>
  );
}

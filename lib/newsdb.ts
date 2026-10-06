import { db } from "./db";
import { classify, isEmptyFilter, type NewsFilter, type NewsLevel } from "./news";
import { parseFeed } from "./feedparse";
import { FetchError, safeFetchText } from "./safefetch";

export type NewsRow = { id: string; url: string; source_name: string; title: string; summary: string | null; published_at: Date; categories: string[]; level: string | null; sport: string | null };
export const PAGE = 20, MAX_PAGE = 20;

export async function listNews(f: NewsFilter, page: number): Promise<{ items: NewsRow[]; more: boolean }> {
  const like = "%" + f.q.replace(/[\\%_]/g, "\\$&") + "%";
  const rows = (await db().query(
    `SELECT id, url, source_name, title, summary, published_at, categories, level, sport FROM news_items
      WHERE hidden_at IS NULL AND published_at > NOW() - make_interval(days => $1)
        AND (cardinality($2::text[]) = 0 OR categories && $2::text[])
        AND (cardinality($3::text[]) = 0 OR level = ANY($3::text[]))
        AND (cardinality($4::text[]) = 0 OR sport = ANY($4::text[]))
        AND ($5 = '' OR title ILIKE $6 OR summary ILIKE $6)
      ORDER BY published_at DESC, id LIMIT $7 OFFSET $8`,
    [f.days, f.categories, f.levels, f.sports, f.q, like, PAGE + 1, Math.min(Math.max(page, 1), MAX_PAGE) * PAGE - PAGE])).rows as NewsRow[];
  return { items: rows.slice(0, PAGE), more: rows.length > PAGE };
}

export async function todayCount(): Promise<number> {
  return (await db().query("SELECT count(*)::int AS n FROM news_items WHERE hidden_at IS NULL AND published_at > NOW() - INTERVAL '24 hours'")).rows[0].n;
}

export async function getPrefs(userId: string): Promise<NewsFilter | null> {
  const r = (await db().query("SELECT categories, levels, sports FROM news_prefs WHERE user_id=$1", [userId])).rows[0];
  return r ? { categories: r.categories, levels: r.levels, sports: r.sports, q: "", days: 30 } : null;
}
export async function savePrefs(userId: string, f: NewsFilter): Promise<void> {
  if (isEmptyFilter({ ...f, q: "" })) { await db().query("DELETE FROM news_prefs WHERE user_id=$1", [userId]); return; }
  await db().query(
    `INSERT INTO news_prefs(user_id, categories, levels, sports) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET categories=$2, levels=$3, sports=$4, updated_at=NOW()`, [userId, f.categories, f.levels, f.sports]);
}

export const MIN_REFETCH_MINUTES = 30, MAX_FAILURES = 10;

/** Fetches one source and stores new items. Errors are recorded on the source (short text only) and never thrown. */
export async function ingestSource(sourceId: string, o: { force?: boolean } = {}): Promise<{ added: number; seen: number; error?: string }> {
  const s = (await db().query(
    `SELECT id, name, feed_url, default_level, default_sport, last_fetched_at FROM news_sources WHERE id=$1 AND active`, [sourceId])).rows[0];
  if (!s) return { added: 0, seen: 0, error: "source not found or inactive" };
  if (!o.force && s.last_fetched_at && Date.now() - new Date(s.last_fetched_at).getTime() < MIN_REFETCH_MINUTES * 60_000) return { added: 0, seen: 0 };
  try {
    const xml = await safeFetchText(s.feed_url, { allowLocal: process.env.NEWS_ALLOW_LOCAL === "1" });
    const items = parseFeed(xml);
    let added = 0;
    for (const it of items) {
      const c = classify(it.title, it.summary, { level: s.default_level as NewsLevel | null, sport: s.default_sport });
      const r = await db().query(
        `INSERT INTO news_items(source_id, url, source_name, title, summary, published_at, categories, level, sport)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (url) DO NOTHING`,
        [s.id, it.url, s.name, it.title, it.summary || null, it.publishedAt, c.categories, c.level, c.sport]);
      added += r.rowCount ?? 0;
    }
    await db().query("UPDATE news_sources SET last_fetched_at=NOW(), last_status='ok', failures=0 WHERE id=$1", [s.id]);
    return { added, seen: items.length };
  } catch (e) {
    const msg = e instanceof FetchError ? e.message : (e as Error).message.slice(0, 120);
    await db().query(
      `UPDATE news_sources SET last_fetched_at=NOW(), last_status=$2, failures=failures+1, active = (failures + 1 < $3) WHERE id=$1`, [s.id, msg.slice(0, 120), MAX_FAILURES]);
    return { added: 0, seen: 0, error: msg };
  }
}

export async function ingestAll(): Promise<{ sources: number; added: number; failed: number }> {
  const ids = (await db().query("SELECT id FROM news_sources WHERE active ORDER BY last_fetched_at NULLS FIRST")).rows.map((r) => r.id as string);
  let added = 0, failed = 0;
  for (const id of ids) { const r = await ingestSource(id); added += r.added; if (r.error) failed++; }
  // Old items age out: after 90 days they're only clutter.
  await db().query("DELETE FROM news_items WHERE published_at < NOW() - INTERVAL '90 days'");
  return { sources: ids.length, added, failed };
}

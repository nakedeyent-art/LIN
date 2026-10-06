"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import { validateReason } from "@/lib/admin";
import { audit } from "@/lib/admindb";
import { isCategory, isLevel, SPORTS } from "@/lib/news";
import { ingestSource } from "@/lib/newsdb";
import { plainText } from "@/lib/news";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (k: "msg" | "error", m: string): never => redirect(`/admin/news?${k}=${encodeURIComponent(m)}`);

async function gate(f: FormData) {
  const s = await requireAdmin();
  const bad = validateReason(str(f, "reason"));
  if (bad) back("error", bad);
  const pw = await checkPassword(s.userId, String(f.get("password") ?? ""));
  if (!pw.ok) back("error", pw.error);
  return { s, reason: str(f, "reason") };
}

export async function addNewsSource(formData: FormData) {
  const { s, reason } = await gate(formData);
  const name = str(formData, "name"), url = str(formData, "feed_url");
  if (name.length < 2 || name.length > 80) back("error", "Name must be 2–80 characters.");
  let u: URL;
  try { u = new URL(url); } catch { return back("error", "Enter the feed's full web address."); }
  const localOk = process.env.NEWS_ALLOW_LOCAL === "1" && process.env.NODE_ENV !== "production" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !localOk) back("error", "Feeds must use https://.");
  const level = str(formData, "default_level"), sport = str(formData, "default_sport");
  const ins = await db().query(
    `INSERT INTO news_sources(name, feed_url, default_level, default_sport) VALUES ($1,$2,$3,$4) ON CONFLICT (feed_url) DO NOTHING RETURNING id`,
    [name, u.toString(), isLevel(level) ? level : null, (SPORTS as readonly string[]).includes(sport) ? sport : null]);
  if (!ins.rowCount) back("error", "That feed is already added.");
  await audit(s.userId, "news_source_add", { detail: `${reason} [${name}]` });
  const r = await ingestSource(ins.rows[0].id, { force: true });
  back(r.error ? "error" : "msg", r.error ? `Added, but the first fetch failed: ${r.error}` : `Added. First fetch found ${r.seen} stories (${r.added} new).`);
}

export async function sourceAction(formData: FormData) {
  const { s, reason } = await gate(formData);
  const id = str(formData, "source_id"), act = str(formData, "act");
  if (!/^[0-9a-f-]{36}$/i.test(id)) back("error", "Unknown source.");
  if (act === "fetch") {
    const r = await ingestSource(id, { force: true });
    await audit(s.userId, "news_source_fetch", { detail: reason });
    back(r.error ? "error" : "msg", r.error ? `Fetch failed: ${r.error}` : `Fetched ${r.seen} stories (${r.added} new).`);
  }
  if (act === "enable" || act === "disable") {
    await db().query("UPDATE news_sources SET active=$2, failures=CASE WHEN $2 THEN 0 ELSE failures END WHERE id=$1", [id, act === "enable"]);
    await audit(s.userId, `news_source_${act}`, { detail: reason });
    back("msg", act === "enable" ? "Source enabled." : "Source disabled.");
  }
  back("error", "Unknown action.");
}

export async function postEditorial(formData: FormData) {
  const { s, reason } = await gate(formData);
  const title = plainText(str(formData, "title"), 200), summary = plainText(str(formData, "summary"), 300);
  if (title.length < 3) back("error", "Give it a headline.");
  const cats = formData.getAll("cat").map(String).filter(isCategory);
  const level = str(formData, "level"), sport = str(formData, "sport");
  const id = crypto.randomUUID();
  await db().query(
    `INSERT INTO news_items(url, source_name, title, summary, published_at, categories, level, sport) VALUES ($1,'LIN',$2,$3,NOW(),$4,$5,$6)`,
    [`lin:editorial:${id}`, title, summary || null, cats.length ? cats : ["general"], isLevel(level) ? level : null, (SPORTS as readonly string[]).includes(sport) ? sport : null]);
  await audit(s.userId, "news_editorial", { detail: `${reason} [${title.slice(0, 80)}]` });
  back("msg", "Posted.");
}

export async function setItemHidden(formData: FormData) {
  const { s, reason } = await gate(formData);
  const id = str(formData, "item_id"), hide = str(formData, "hide") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) back("error", "Unknown story.");
  await db().query("UPDATE news_items SET hidden_at = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE id=$1", [id, hide]);
  await audit(s.userId, hide ? "news_hide" : "news_unhide", { detail: `${reason} [${id}]` });
  back("msg", hide ? "Story hidden." : "Story restored.");
}


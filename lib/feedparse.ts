import { XMLParser } from "fast-xml-parser";
import { plainText } from "./news";

export type FeedItem = { url: string; title: string; summary: string; publishedAt: Date };
const MAX_ITEMS = 50, MAX_AGE_DAYS = 30;

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") { const o = v as Record<string, unknown>; return text(o["#text"] ?? o["__cdata"] ?? ""); }
  return "";
};
const asArray = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const httpUrl = (s: string): string | null => { try { const u = new URL(s.trim()); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; } };

/** RSS 2.0 and Atom. Plain text only; entity expansion is off (no XML bombs); anything odd is skipped, not fatal. */
export function parseFeed(xml: string, now = new Date()): FeedItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false, parseTagValue: false, trimValues: true, cdataPropName: "__cdata" });
  let doc: Record<string, any>;
  try { doc = parser.parse(xml); } catch { throw new Error("not valid XML"); }
  const rssItems = asArray(doc?.rss?.channel?.item) as Record<string, unknown>[];
  const atomItems = asArray(doc?.feed?.entry) as Record<string, unknown>[];
  if (!rssItems.length && !atomItems.length && !doc?.rss && !doc?.feed) throw new Error("not an RSS or Atom feed");
  const cutoff = now.getTime() - MAX_AGE_DAYS * 86400_000;
  const out: FeedItem[] = [];
  for (const it of [...rssItems, ...atomItems]) {
    const link = text(it.link) || asArray(it.link as any).map((l: any) => (typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate") ? l["@_href"] : "")).find(Boolean) || "";
    const url = httpUrl(String(link));
    const title = plainText(decode(text(it.title)), 200);
    const when = new Date(text(it.pubDate) || text(it.published) || text(it.updated) || text(it["dc:date"]));
    if (!url || title.length < 3 || Number.isNaN(when.getTime()) || when.getTime() > now.getTime() + 86400_000 || when.getTime() < cutoff) continue;
    out.push({ url, title, summary: plainText(decode(text(it.description) || text(it.summary) || text(it.content)), 240), publishedAt: when });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

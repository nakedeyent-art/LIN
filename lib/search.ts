/** Pure search helpers. */
export const MIN_QUERY = 2, MAX_QUERY = 80;
export const cleanQuery = (q: string): string => q.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
export const queryOk = (q: string) => q.length >= MIN_QUERY;

/** A short plain-text excerpt around the first match (the caller renders it escaped and bolds nothing: no HTML is ever built from user text). */
export function excerpt(body: string, q: string, width = 160): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2 && !w.startsWith("-"));
  const lower = flat.toLowerCase();
  const at = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0), Infinity);
  if (!Number.isFinite(at)) return flat.slice(0, width) + (flat.length > width ? "…" : "");
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(flat.length, start + width);
  return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
}

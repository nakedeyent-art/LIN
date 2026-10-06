/** Pure news rules: categories, automatic tagging, filters. */
export const CATEGORIES = ["rankings", "reclassification", "graduating_seniors", "redshirt", "powerhouse", "general"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABEL: Record<Category, string> = {
  rankings: "Rankings", reclassification: "Reclassification", graduating_seniors: "Graduating seniors & commitments",
  redshirt: "Redshirts", powerhouse: "Powerhouse programs", general: "General",
};
export const LEVELS = ["high_school", "college"] as const;
export type NewsLevel = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<NewsLevel, string> = { high_school: "High school", college: "College" };
export const SPORTS = ["football", "basketball", "baseball", "softball", "soccer", "volleyball", "track", "swimming", "wrestling", "lacrosse", "hockey", "tennis", "golf", "cross country", "gymnastics"] as const;
export const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);
export const isLevel = (l: string): l is NewsLevel => (LEVELS as readonly string[]).includes(l);

const RULES: [Category, RegExp][] = [
  ["rankings", /\b(rankings?|ranked|top[- ]?\d{1,3}|top[- ]25|poll|power rankings?|no\. ?\d{1,2}|#\d{1,2}|rises? to|drops? to|climbs?)\b/i],
  ["reclassification", /\b(reclass(ify|ified|ifies|ification)?|reclassing|repeat(ing)? a (grade|year)|class of 20\d\d to 20\d\d)\b/i],
  ["graduating_seniors", /\b(seniors?|senior day|graduat\w+|signing day|signs? (with|to)|signees?|commit(s|ted|ment|ments)?|national letter|early signing|transfer portal|decommit\w*)\b/i],
  ["redshirt", /\b(red[- ]?shirt\w*|medical hardship|extra year of eligibility|eligibility waiver)\b/i],
  ["powerhouse", /\b(powerhouse|dynasty|state champion\w*|national champion\w*|mythical national|nationally ranked|perennial|top program|juggernaut)\b/i],
];
const HS = /\b(high[- ]school|prep|preps|varsity|state (playoffs?|tournament|title)|\bhs\b|class of 20\d\d|recruit(s|ing)? (class|rankings?)|aau|prep school)\b/i;
const COLLEGE = /\b(college|ncaa|naia|njcaa|d-?(i|ii|iii)\b|division (i|ii|iii)|ncaa tournament|conference|transfer portal|fbs|fcs|big (ten|12|east)|sec\b|acc\b|pac-12|march madness)\b/i;

/** Keyword tagging. A story can carry several categories; none matched means "general". */
export function classify(title: string, summary = "", hint?: { level?: NewsLevel | null; sport?: string | null }): { categories: Category[]; level: NewsLevel | null; sport: string | null } {
  const text = `${title}. ${summary}`;
  const categories = RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
  const hs = HS.test(text), col = COLLEGE.test(text);
  const level: NewsLevel | null = hs && !col ? "high_school" : col && !hs ? "college" : hint?.level ?? (hs && col ? null : null);
  const lower = text.toLowerCase();
  const sport = SPORTS.find((s) => new RegExp(`\\b${s}\\b`).test(lower)) ?? hint?.sport?.toLowerCase() ?? null;
  return { categories: categories.length ? categories : ["general"], level, sport };
}

export type NewsFilter = { categories: Category[]; levels: NewsLevel[]; sports: string[]; q: string; days: 1 | 7 | 30 };
export const MAX_Q = 80;

/** Reads a filter from query params / a form; unknown values are dropped, never trusted. */
export function parseFilter(get: (k: string) => string[]): NewsFilter {
  const days = Number(get("days")[0]);
  return {
    categories: get("cat").filter(isCategory),
    levels: get("level").filter(isLevel),
    sports: get("sport").map((s) => s.toLowerCase()).filter((s) => (SPORTS as readonly string[]).includes(s)),
    q: (get("q")[0] ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_Q),
    days: days === 1 || days === 7 ? days : 30,
  };
}
export const isEmptyFilter = (f: NewsFilter) => !f.categories.length && !f.levels.length && !f.sports.length && !f.q;

/** Where a summary may come from: plain text only, bounded. Used on feed text (which may contain HTML) before storing. */
export function plainText(raw: string, max: number): string {
  const t = raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

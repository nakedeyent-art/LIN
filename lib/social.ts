/** Pure social rules: who may follow whom, who may see what, and text limits. */
export const MAX_POST = 500, MAX_COMMENT = 300, MAX_STATUS = 80, MAX_LABEL = 60;
export const MAX_POSTS_PER_HOUR = 10, MAX_COMMENTS_PER_10_MIN = 20, MAX_FOLLOWS_PER_DAY = 50;
export const FEED_PAGE = 15;

export function cleanText(raw: string, max: number): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[^\S\n]+\n/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > max) return { ok: false, error: `Keep it to ${max} characters.` };
  return { ok: true, text };
}

export type FollowTarget = { id: string; isMinor: boolean; unavailable: boolean };
export type FollowDecision = { ok: true; status: "approved" | "pending" } | { ok: false; error: string };

/** Following an adult is instant. Following a minor is a request that one of their guardians must approve. */
export function followDecision(v: { id: string; role: string; isGuardianOfTarget: boolean }, t: FollowTarget, o: { blocked: boolean; existing: "pending" | "approved" | null }): FollowDecision {
  const generic: FollowDecision = { ok: false, error: "You can't follow this person." };   // never reveals blocks or suspensions
  if (v.id === t.id) return { ok: false, error: "That's you." };
  if (o.blocked || t.unavailable) return generic;
  if (v.isGuardianOfTarget) return { ok: false, error: "You already see your athlete's posts." };
  if (o.existing === "approved") return { ok: false, error: "You already follow this person." };
  if (o.existing === "pending") return { ok: false, error: "Your request is waiting for a parent/guardian." };
  if (t.isMinor && v.role === "booster") return { ok: false, error: "Boosters and collectives can't follow high-school athletes." };
  return { ok: true, status: t.isMinor ? "pending" : "approved" };
}

/** Mirror of the SQL in lib/socialdb.ts (VISIBLE_POST), kept pure so the rule itself is unit-tested. */
export function postVisible(o: { viewerId: string; authorId: string; authorIsMinor: boolean; approvedFollower: boolean; guardianOfAuthor: boolean; blocked: boolean; authorUnavailable: boolean }): boolean {
  if (o.blocked || o.authorUnavailable) return false;
  if (o.viewerId === o.authorId) return true;
  if (!o.authorIsMinor) return true;               // adults post to every signed-in user
  return o.approvedFollower || o.guardianOfAuthor; // a minor's posts reach only approved followers and guardians
}

export const initial = (name: string) => (name.trim().charAt(0) || "?").toUpperCase();
export function timeAgo(then: Date, now = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`; return then.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type ComposeState = { error?: string; posted?: number; draft?: string };
export type CommentState = { error?: string; sent?: number; draft?: string };

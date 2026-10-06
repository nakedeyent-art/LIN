/** Pure messaging rules: who may post on a deal, message cleanup, rate limit. */
import type { Capacity, DealStatus } from "./deals";
import { isOpen } from "./deals";

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_MESSAGES_PER_MINUTE = 8;
export const THREAD_PAGE = 200;
export const REMOVED_BODY = "[message removed]";
export const HIDDEN_BODY = "[removed by a moderator]";

export type PostCheck = { ok: true } | { ok: false; error: string };

/**
 * The thread is open while the deal is being negotiated, signed, active or finished (people need to talk about
 * refunds and follow-ups), and closes when the offer ended without a deal. A minor's thread needs a linked guardian
 * who can read it: no guardian, no messages.
 */
export function canPostMessage(d: {
  who: Capacity | null; athleteIsMinor: boolean; athleteHasGuardian: boolean; status: DealStatus; expired: boolean; blocked?: boolean;
}): PostCheck {
  if (!d.who) return { ok: false, error: "Only the people on this deal can message here." };
  if (d.who === "guardian" && !d.athleteIsMinor) return { ok: false, error: "Guardian access ended when the athlete turned 18." };
  if (d.blocked) return { ok: false, error: "Messaging isn't available on this deal right now." };   // deliberately vague: never reveals who blocked whom
  if (d.status === "declined" || d.status === "withdrawn") return { ok: false, error: "This offer ended, so the conversation is closed." };
  if (isOpen(d.status) && d.expired) return { ok: false, error: "This offer has expired, so the conversation is closed." };
  if (d.athleteIsMinor && !d.athleteHasGuardian) return { ok: false, error: "Messaging is paused until a parent/guardian is linked to this athlete." };
  return { ok: true };
}

/** Trim, normalise line endings, drop control characters, squash blank-line runs. */
export function cleanBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.replace(/\r\n?/g, "\n").replace(/[^\S\n]+\n/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > MAX_MESSAGE_CHARS) return { ok: false, error: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.` };
  return { ok: true, body };
}

export const rateLimited = (recentCount: number) => recentCount >= MAX_MESSAGES_PER_MINUTE;

export const CAPACITY_LABEL: Record<Capacity, string> = { counterparty: "Sponsor", athlete: "Athlete", guardian: "Parent/guardian" };

export type PostState = { error?: string; sent?: number; draft?: string };

/** Pure rules for the "athlete turned 18" transition job. SQL decides *who is an adult*; this decides what to do. */

export const STALE_DAYS = 30;      // matches the in-app notice window: older than this, a birthday email would be noise
export const MAX_ATTEMPTS = 5;     // delivery attempts before the job gives up on an athlete

const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);

/**
 * The first date on which the app treats this person as an adult (YYYY-MM-DD). Mirrors the SQL rule used everywhere
 * (`birth_date <= CURRENT_DATE - INTERVAL '18 years'`): a Feb 29 birthday becomes adult on Mar 1.
 */
export function adultOn(birth: string): string {
  const [y, m, d] = birth.split("-").map(Number);
  const yy = y + 18;
  const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
  if (m === 2 && d === 29 && !leap) return `${yy}-03-01`;
  return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type Disposition =
  | "send"                  // they were a minor on LIN and turned 18 recently: tell them (and their guardians)
  | "skip_adult_at_signup"  // joined already 18+: there was never a guardian era to end
  | "skip_stale";           // turned 18 more than STALE_DAYS ago: mark done quietly, don't email

export function classify(birth: string, createdOn: string, today: string): Disposition {
  const adult = adultOn(birth);
  if (dayNum(createdOn) >= dayNum(adult)) return "skip_adult_at_signup";
  if (dayNum(today) - dayNum(adult) > STALE_DAYS) return "skip_stale";
  return "send";
}

/** Retry policy after a failed delivery: attempts so far (before this one) -> keep trying or give up. */
export const shouldGiveUp = (attemptsIncludingThis: number) => attemptsIncludingThis >= MAX_ATTEMPTS;

/**
 * Cron endpoint authorization. 'unconfigured' means the secret is missing or too short — the endpoint must refuse to run
 * rather than be open. Comparison is on fixed-length digests so timing doesn't leak the secret.
 */
export function authorizeCron(header: string | null, secret: string | undefined, digest: (s: string) => string): "ok" | "denied" | "unconfigured" {
  if (!secret || secret.length < 16) return "unconfigured";
  const m = /^Bearer (.+)$/.exec(header ?? "");
  if (!m) return "denied";
  const a = digest(m[1]), b = digest(secret);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0 ? "ok" : "denied";
}

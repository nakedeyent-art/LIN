import { subjectsFor, subjectFor, canEditFamily } from "./access";
import { db } from "./db";
import { listDeals } from "./dealsdb";
import { snapshots } from "./snapshot";
import type { Session } from "./session";

export const ATHLETE_TABS = ["overview", "schedule", "recruiting", "deals", "documents", "development", "team", "activity"] as const;
export type AthleteTab = typeof ATHLETE_TABS[number];
export const validId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export { subjectsFor, subjectFor, canEditFamily };

/** Every rollup is filtered through its existing source's access rules. */
export async function athleteOverview(s: Session, athleteId: string) {
  if (!validId(athleteId)) return null;
  const subject = await subjectFor(s, athleteId);
  if (!subject) return null;
  const [summary, visibleDeals] = await Promise.all([
    snapshots([subject], new Date().toISOString().slice(0, 10)), listDeals(s.userId),
  ]);
  const deals = visibleDeals.filter(d => d.athlete_id === athleteId);
  // Team composition is family-controlled; consent to a single data category is not roster consent.
  const team = canEditFamily(subject) ? (await db().query(`SELECT u.full_name, r.relationship, r.can_view_academics, r.can_view_health
    FROM athlete_relationships r JOIN users u ON u.id=r.member_id WHERE r.athlete_id=$1 ORDER BY u.full_name`, [athleteId])).rows : [];
  return { subject, summary: summary[0], deals, team };
}

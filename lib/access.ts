import { db } from "./db";
import type { Session } from "./session";
import type { Role } from "./roles";

export type Subject = {
  id: string; name: string; sport: string | null; level: string; minor: boolean; inSeason: boolean;
  relationship: "self" | Role;
  academics: boolean; health: boolean;   // what the viewer may see (nutrition + training = "health")
};

const BASE = `SELECT u.id, u.full_name, ap.sport, ap.level, ap.in_season,
         ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor`;

/**
 * Every athlete this user may see, with exactly what they may see. This is the single authorization
 * source for academics / nutrition / training data: an athlete sees themself; everyone else needs an
 * athlete_relationships row that matches their role (guardians additionally need guardian_approved).
 */
export async function subjectsFor(s: Pick<Session, "userId" | "role">): Promise<Subject[]> {
  if (s.role === "athlete") {
    const { rows } = await db().query(`${BASE} FROM users u JOIN athlete_profiles ap ON ap.user_id = u.id WHERE u.id = $1`, [s.userId]);
    return rows.map((r) => ({ ...shape(r), relationship: "self" as const, academics: true, health: true }));
  }
  const rel = s.role === "parent" ? "parent" : s.role;
  const { rows } = await db().query(
    `${BASE}, r.can_view_academics, r.can_view_health
       FROM athlete_relationships r JOIN users u ON u.id = r.athlete_id JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE r.member_id = $1 AND r.relationship::text = $2 AND (r.relationship <> 'parent' OR r.guardian_approved)
      ORDER BY u.full_name`, [s.userId, rel]);
  return rows.map((r) => ({ ...shape(r), relationship: s.role, academics: r.can_view_academics, health: r.can_view_health }));
}

const shape = (r: Record<string, unknown>) => ({
  id: r.id as string, name: r.full_name as string, sport: (r.sport as string) ?? null, level: r.level as string,
  minor: !!r.minor, inSeason: !!r.in_season,
});

export async function subjectFor(s: Pick<Session, "userId" | "role">, athleteId: string | undefined | null): Promise<Subject | null> {
  const all = await subjectsFor(s);
  return (athleteId && all.find((x) => x.id === athleteId)) || null;
}

/** Page helper: all viewable subjects for `kind`, and the selected one (query param or first). */
export async function pickSubject(s: Pick<Session, "userId" | "role">, kind: "academics" | "health", requested?: string) {
  const subjects = (await subjectsFor(s)).filter((x) => x[kind]);
  const selected = subjects.find((x) => x.id === requested) ?? subjects[0] ?? null;
  return { subjects, selected };
}

export async function prescriberInfo(userId: string) {
  const r = (await db().query("SELECT declared_role, credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1", [userId])).rows[0];
  return { declaredRole: (r?.declared_role as string) ?? null, credential: (r?.credential_type as string) ?? null, verified: !!r?.credential_verified };
}

/** Can this user act as the athlete's decision-maker (adult athlete themself, or a linked guardian of a minor)? */
export async function canManageTeam(s: Pick<Session, "userId" | "role">, athleteId: string): Promise<boolean> {
  if (s.role === "athlete") {
    if (s.userId !== athleteId) return false;
    const p = (await db().query("SELECT birth_date <= CURRENT_DATE - INTERVAL '18 years' AS adult FROM athlete_profiles WHERE user_id=$1", [athleteId])).rows[0];
    return !!p?.adult;
  }
  if (s.role === "parent") {
    return !!(await db().query(
      "SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2 AND relationship='parent' AND guardian_approved", [athleteId, s.userId])).rowCount;
  }
  return false;
}

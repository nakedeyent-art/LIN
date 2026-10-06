"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const STAGES = ["watching", "evaluating", "contacted", "passed"];
const UUID = /^[0-9a-f-]{36}$/i;
async function recruiterOnly() {
  const s = await requireUser();
  if (s.role !== "recruiter") redirect("/dashboard");
  return s;
}

/** Recruiters can only track athletes the directory would show them (opted in, verified, guardian linked if a minor). */
export async function trackAthlete(formData: FormData) {
  const s = await recruiterOnly();
  const id = String(formData.get("athlete_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/athletes");
  await db().query(
    `INSERT INTO recruiting_board(recruiter_id, athlete_id)
     SELECT $1, u.id FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id
      WHERE u.id = $2 AND ap.discoverable AND u.email_verified_at IS NOT NULL
        AND (ap.birth_date <= CURRENT_DATE - INTERVAL '18 years' OR EXISTS (
              SELECT 1 FROM guardian_links r WHERE r.athlete_id = u.id))
     ON CONFLICT (recruiter_id, athlete_id) DO NOTHING`, [s.userId, id]);
  redirect("/dashboard");
}

export async function setStage(formData: FormData) {
  const s = await recruiterOnly();
  const id = String(formData.get("id") ?? ""), stage = String(formData.get("stage") ?? "");
  if (UUID.test(id) && STAGES.includes(stage)) await db().query("UPDATE recruiting_board SET stage=$3, updated_at=NOW() WHERE id=$1 AND recruiter_id=$2", [id, s.userId, stage]);
  redirect("/dashboard");
}

export async function untrack(formData: FormData) {
  const s = await recruiterOnly();
  const id = String(formData.get("id") ?? "");
  if (UUID.test(id)) await db().query("DELETE FROM recruiting_board WHERE id=$1 AND recruiter_id=$2", [id, s.userId]);
  redirect("/dashboard");
}

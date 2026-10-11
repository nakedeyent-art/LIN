import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** POST (not GET) so a link on another site can't trigger it. Returns only the signed-in user's own data. */
export async function POST() {
  const s = await getSession();
  if (!s || !s.emailVerified) return new Response("Unauthorized", { status: 401 });
  const q = async (sql: string) => (await db().query(sql, [s.userId])).rows;
  const data = {
    exportedAt: new Date().toISOString(),
    account: (await q("SELECT id, email, full_name, role, email_verified_at, created_at FROM users WHERE id=$1"))[0],
    athleteProfile: (await q("SELECT sport, position, level, state, grad_year, birth_date, height_cm, weight_kg, sex, activity_factor, in_season, discoverable FROM athlete_profiles WHERE user_id=$1"))[0] ?? null,
    professionalDeclaration: (await q("SELECT declared_role, credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1"))[0] ?? null,
    grades: await q("SELECT course_name, current_grade, logged_at FROM academic_logs WHERE athlete_id=$1 ORDER BY logged_at"),
    studySessions: await q("SELECT subject, minutes, studied_on, note, verified_at FROM study_sessions WHERE athlete_id=$1 ORDER BY studied_on"),
    meals: await q("SELECT meal_name, calories, protein_grams, carbs_grams, fats_grams, logged_on FROM food_logs WHERE athlete_id=$1 ORDER BY logged_on"),
    nutritionPlans: await q("SELECT target_body_profile, target_calories, protein_grams, carbs_grams, fats_grams, bmr_kcal, created_at FROM nutrition_plans WHERE athlete_id=$1 ORDER BY created_at"),
    workouts: await q("SELECT title, focus_area, scheduled_date, status, adherence_score, workout_json, athlete_notes FROM athlete_workouts WHERE athlete_id=$1 ORDER BY scheduled_date"),
    deals: await q(`SELECT d.title, d.amount_cents, d.deliverables, d.status, d.created_at, d.expires_at,
                           a.full_name AS athlete, c.full_name AS offered_by
                      FROM deals d JOIN users a ON a.id = d.athlete_id JOIN users c ON c.id = d.counterparty_id
                     WHERE d.athlete_id=$1 OR d.counterparty_id=$1 ORDER BY d.created_at`),
    team: await q(`SELECT u.full_name, u.email, r.relationship, r.can_view_academics, r.can_view_health, r.created_at
                     FROM athlete_relationships r JOIN users u ON u.id = r.member_id WHERE r.athlete_id=$1`),
    events: await q("SELECT name, sport, location, starts_on, status FROM events WHERE organizer_id=$1 ORDER BY starts_on"),
    documents: await q("SELECT id,title,category,folder,tags,status,expires_on,deal_id,event_id,created_at FROM athlete_documents WHERE athlete_id=$1"),
    documentVersions: await q("SELECT v.document_id,v.version,v.file_name,v.media_type,v.sha256,v.created_at FROM document_versions v JOIN athlete_documents d ON d.id=v.document_id WHERE d.athlete_id=$1"),
    signingEvidence: await q("SELECT envelope_id,document_sha256,field_values,consent_version,signed_at FROM signing_evidence WHERE user_id=$1"),
    operationalTasks: await q("SELECT id,title,due_at,status,event_id,deal_id,stop_id FROM operational_tasks WHERE athlete_id=$1"),
    operationalExpenses: await q("SELECT id,description,amount_cents,currency,status,event_id,stop_id FROM operational_expenses WHERE athlete_id=$1"),
    travelRoutes: await q("SELECT id,name,created_at FROM travel_routes WHERE athlete_id=$1"),
    travelStops: await q("SELECT s.* FROM travel_stops s JOIN travel_routes r ON r.id=s.route_id WHERE r.athlete_id=$1"),
    scoutingReportsAuthored: await q("SELECT * FROM scouting_reports WHERE author_id=$1"),
    recruitingBoard: await q("SELECT athlete_id, stage, updated_at FROM recruiting_board WHERE recruiter_id=$1"),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lin-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

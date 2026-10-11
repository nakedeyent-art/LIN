import { db } from "./db";

/** Everything LIN holds about one person, in their own words and records. Never includes another person's private content (messages are only the ones THEY wrote). */
export async function buildExport(userId: string) {
  const q = async (sql: string) => (await db().query(sql, [userId])).rows;
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
    travelStopContacts: await q("SELECT c.stop_id,c.name,c.role,c.phone,c.email,c.notes FROM travel_stop_contacts c JOIN travel_stops s ON s.id=c.stop_id JOIN travel_routes r ON r.id=s.route_id WHERE r.athlete_id=$1"),
    travelStopDocuments: await q("SELECT l.stop_id,l.document_id FROM travel_stop_documents l JOIN travel_stops s ON s.id=l.stop_id JOIN travel_routes r ON r.id=s.route_id WHERE r.athlete_id=$1"),
    scoutingReportsAuthored: await q("SELECT * FROM scouting_reports WHERE author_id=$1"),
    recruitingBoard: await q("SELECT athlete_id, stage, updated_at FROM recruiting_board WHERE recruiter_id=$1"),
    // Added: the rest of what the app stores about a person.
    messagesWritten: await q("SELECT deal_id, body, created_at, hidden_at IS NOT NULL AS hidden_by_moderator FROM deal_messages WHERE sender_id=$1 ORDER BY id"),
    attachmentsUploaded: await q("SELECT deal_id, filename, content_type, size_bytes, sha256, created_at FROM deal_attachments WHERE uploader_id=$1"),
    posts: await q("SELECT id, body, created_at, deleted_at, hidden_at IS NOT NULL AS hidden_by_moderator FROM posts WHERE author_id=$1 ORDER BY id"),
    comments: await q("SELECT id, post_id, body, created_at, deleted_at FROM post_comments WHERE author_id=$1 ORDER BY id"),
    likes: await q("SELECT post_id, created_at FROM post_likes WHERE user_id=$1"),
    following: await q("SELECT u.full_name AS person, f.status, f.created_at FROM follows f JOIN users u ON u.id=f.followee_id WHERE f.follower_id=$1"),
    followers: await q("SELECT u.full_name AS person, f.status, f.created_at FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followee_id=$1"),
    blocks: await q("SELECT u.full_name AS person, b.created_at FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1"),
    profileStatus: (await q("SELECT status_text, music_provider, music_kind, music_label, updated_at FROM profile_status WHERE user_id=$1"))[0] ?? null,
    reportsFiled: await q("SELECT 'message' AS kind, reason, note, status, created_at FROM message_reports WHERE reporter_id=$1 UNION ALL SELECT 'post_or_comment', reason, note, status, created_at FROM content_reports WHERE reporter_id=$1"),
    notifications: await q("SELECT kind, title, href, created_at, read_at FROM notifications WHERE user_id=$1 ORDER BY id"),
    newsPreferences: (await q("SELECT categories, levels, sports FROM news_prefs WHERE user_id=$1"))[0] ?? null,
    emailPreferences: (await q("SELECT email_deal_updates, email_messages FROM users WHERE id=$1"))[0],
    securityActivity: await q("SELECT action, created_at FROM security_events WHERE user_id=$1 ORDER BY id"),
    twoFactor: (await q("SELECT enabled_at IS NOT NULL AS enabled, enabled_at FROM user_mfa WHERE user_id=$1"))[0] ?? { enabled: false },
    organizations: await q("SELECT o.name, m.role, m.joined_at, o.archived_at FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1"),
    organizationInvitations: await q("SELECT o.name, i.status, i.created_at, i.expires_at FROM organization_invites i JOIN organizations o ON o.id=i.organization_id WHERE i.invited_user_id=$1"),
    paymentsAsPayee: await q("SELECT deal_id, amount_cents, fee_cents, status, created_at, released_at, refunded_at FROM deal_payments WHERE payee_user_id=$1"),
    signingRecipientRecords: await q("SELECT r.envelope_id, r.capacity, r.status, e.title FROM signing_recipients r JOIN signing_envelopes e ON e.id=r.envelope_id WHERE r.user_id=$1"),
    scoutingTemplates: await q("SELECT * FROM scouting_templates WHERE owner_id=$1"),
    scoutingStages: await q("SELECT * FROM scouting_stages WHERE owner_id=$1"),
    athleteMetrics: await q("SELECT * FROM athlete_metrics WHERE athlete_id=$1"),
  };
  return data;
}

"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess, requireUser } from "@/lib/session";
import {
  ALL_ACTIONS, applyAction, canOffer, type DealAction, type DealStatus, type Level, MAX_OPEN_OFFERS_PER_PAIR,
  OFFER_TTL_DAYS, parseDollarsToCents,
} from "@/lib/deals";
import { capacityOn, dealContext, hasLinkedGuardian, notifyDeal, type DealRow } from "@/lib/dealsdb";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createOffer(formData: FormData) {
  const s = await requireAccess("/dashboard/athletes");
  const athleteId = str(formData, "athlete_id");
  const back = (msg: string): never =>
    redirect(`/dashboard/deals/new?athlete=${encodeURIComponent(athleteId)}&error=${encodeURIComponent(msg)}`);

  const title = str(formData, "title");
  const deliverables = str(formData, "deliverables");
  const cents = parseDollarsToCents(str(formData, "amount"));
  if (title.length < 3 || title.length > 100) back("Title must be 3–100 characters.");
  if (deliverables.length < 20 || deliverables.length > 2000) back("Describe the deliverables in 20–2000 characters (what the athlete will do in return).");
  if (cents === null) back("Enter a valid amount between $0.01 and $1,000,000.");
  if (formData.get("attest") !== "on") back("You must confirm the compensation is for NIL deliverables only.");

  if (!/^[0-9a-f-]{36}$/i.test(athleteId)) back("Unknown athlete.");
  const a = (await db().query(
    `SELECT ap.level, ap.discoverable, u.email_verified_at IS NOT NULL AS verified,
            ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
       FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.user_id = $1`, [athleteId])).rows[0];
  // Same visibility as the directory: an athlete who isn't listed can't be approached.
  if (!a || !a.discoverable || !a.verified || (a.minor && !(await hasLinkedGuardian(athleteId)))) back("This athlete isn't available for offers.");
  const ok = canOffer(s.role, a.level as Level);
  if (!ok.ok) back(ok.error);

  const open = (await db().query(
    `SELECT count(*)::int AS n FROM deals WHERE athlete_id=$1 AND counterparty_id=$2 AND status IN ('offered','guardian_review')`,
    [athleteId, s.userId])).rows[0].n;
  if (open >= MAX_OPEN_OFFERS_PER_PAIR) back(`You already have ${MAX_OPEN_OFFERS_PER_PAIR} open offers to this athlete.`);

  const client = await db().connect();
  let id: string;
  try {
    await client.query("BEGIN");
    id = (await client.query(
      `INSERT INTO deals(athlete_id, counterparty_id, title, amount_cents, deliverables, status, attested_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,'offered',NOW(), NOW() + make_interval(days => $6)) RETURNING id`,
      [athleteId, s.userId, title, cents, deliverables, OFFER_TTL_DAYS])).rows[0].id;
    await client.query("INSERT INTO deal_events(deal_id, actor_id, action, from_status, to_status) VALUES ($1,$2,'offer',NULL,'offered')", [id, s.userId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  await notifyDeal(id, s.userId, "offered", true);
  redirect(`/dashboard/deals/${id}?msg=${encodeURIComponent("Offer sent.")}`);
}

export async function dealAction(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const dealId = str(formData, "deal_id");
  const action = str(formData, "action") as DealAction;
  const back = (msg: string, key = "error"): never => redirect(`/dashboard/deals/${dealId}?${key}=${encodeURIComponent(msg)}`);
  if (!ALL_ACTIONS.includes(action) || !/^[0-9a-f-]{36}$/i.test(dealId)) redirect("/dashboard/deals");

  const client = await db().connect();
  let newStatus: DealStatus;
  try {
    await client.query("BEGIN");
    // Lock the row so two concurrent decisions can't both pass the state check.
    const locked = await client.query("SELECT id FROM deals WHERE id=$1 FOR UPDATE", [dealId]);
    if (!locked.rowCount) { await client.query("ROLLBACK"); redirect("/dashboard/deals"); }
    const d = (await client.query(
      `SELECT d.id, d.title, d.amount_cents::float8 AS amount_cents, d.deliverables, d.status, d.expires_at, d.created_at, d.attested_at,
              d.athlete_id, d.counterparty_id, '' AS athlete_name,
              COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor, '' AS counterparty_name, '' AS counterparty_role
         FROM deals d LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id WHERE d.id=$1`, [dealId])).rows[0] as DealRow;
    const who = await capacityOn(s.userId, d, client);
    if (!who) { await client.query("ROLLBACK"); redirect("/dashboard/deals"); } // no standing: behave as if it doesn't exist
    const t = applyAction(await dealContext(d, client), who!, action);
    if (!t.ok) { await client.query("ROLLBACK"); return back(t.error); }
    await client.query(
      `UPDATE deals SET status=$2, updated_at=NOW(),
         guardian_approved_by = CASE WHEN $3 THEN $4::uuid ELSE guardian_approved_by END WHERE id=$1`,
      [dealId, t.status, action === "approve", s.userId]);
    await client.query("INSERT INTO deal_events(deal_id, actor_id, action, from_status, to_status) VALUES ($1,$2,$3,$4,$5)",
      [dealId, s.userId, action, d.status, t.status]);
    await client.query("COMMIT");
    newStatus = t.status;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
  await notifyDeal(dealId, s.userId, newStatus);
  back("Updated.", "msg");
}

export async function setDiscoverable(formData: FormData) {
  const s = await requireUser();
  if (s.role !== "athlete") redirect("/dashboard");
  const on = formData.get("on") === "1";
  if (on) {
    const p = (await db().query(
      "SELECT birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor FROM athlete_profiles WHERE user_id=$1", [s.userId])).rows[0];
    if (!p) redirect("/dashboard");
    if (p.minor && !(await hasLinkedGuardian(s.userId)))
      redirect(`/dashboard/deals?error=${encodeURIComponent("A linked parent/guardian is required before you can be listed to sponsors.")}`);
  }
  await db().query("UPDATE athlete_profiles SET discoverable=$2 WHERE user_id=$1", [s.userId, on]);
  redirect("/dashboard/deals");
}

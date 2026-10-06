"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, notifyDeal, type DealRow } from "@/lib/dealsdb";
import { canSign, ESIGN_CONSENT_VERSION, executionState, nameMatches, type SigRole } from "@/lib/contract";
import { notifyDealParties } from "@/lib/payments";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Records one e-signature. The signer types their name and ticks the e-sign consent; we store the typed name, the exact
 * document hash they signed, the consent version, the time, and network details. When the last required signature lands the
 * contract is executed and the deal becomes active — in the same transaction, under a row lock.
 */
export async function signContract(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const dealId = String(formData.get("deal_id") ?? "");
  const typed = String(formData.get("typed_name") ?? "").trim();
  const back = (msg: string): never => redirect(`/dashboard/deals/${dealId}/contract?error=${encodeURIComponent(msg)}`);
  if (!UUID.test(dealId)) redirect("/dashboard/deals");
  if (formData.get("consent") !== "on") back("Tick the box to confirm you agree to sign electronically.");

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const ua = (h.get("user-agent") ?? "").slice(0, 300) || null;

  const client = await db().connect();
  let executed = false, role: SigRole;
  try {
    await client.query("BEGIN");
    if (!(await client.query("SELECT 1 FROM deals WHERE id=$1 FOR UPDATE", [dealId])).rowCount) { await client.query("ROLLBACK"); redirect("/dashboard/deals"); }
    const d = (await client.query(
      `SELECT d.id, d.status, d.expires_at, d.athlete_id, d.counterparty_id, d.title, d.amount_cents::float8 AS amount_cents, d.deliverables, d.created_at, d.attested_at,
              COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor, '' AS athlete_name, '' AS counterparty_name, '' AS counterparty_role
         FROM deals d LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id WHERE d.id=$1`, [dealId])).rows[0] as DealRow;
    const who = await capacityOn(s.userId, d, client);
    if (!who) { await client.query("ROLLBACK"); redirect("/dashboard/deals"); }
    const k = (await client.query("SELECT id, sha256, voided_at, executed_at FROM contracts WHERE deal_id=$1", [dealId])).rows[0];
    if (!k) { await client.query("ROLLBACK"); return back("There is no agreement to sign yet."); }
    const existing = (await client.query("SELECT signer_user_id, signer_role FROM contract_signatures WHERE contract_id=$1", [k.id])).rows;
    const ctx = await dealContext(d, client);
    const check = canSign({
      who: who!, athleteIsMinor: ctx.athleteIsMinor, status: d.status, expired: ctx.expired, voided: !!k.voided_at,
      alreadySigned: existing.some((e) => e.signer_user_id === s.userId),
    });
    if (!check.ok) { await client.query("ROLLBACK"); return back(check.error); }
    role = check.role;
    const account = (await client.query("SELECT full_name FROM users WHERE id=$1", [s.userId])).rows[0].full_name as string;
    if (!nameMatches(typed, account)) { await client.query("ROLLBACK"); return back(`Type your full name exactly as it appears on your account (${account}) to sign.`); }

    await client.query(
      `INSERT INTO contract_signatures(contract_id, signer_user_id, signer_role, typed_name, consent_version, document_sha256, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [k.id, s.userId, role, typed.replace(/\s+/g, " "), ESIGN_CONSENT_VERSION, k.sha256, ip, ua]);
    const roles = [...existing.map((e) => e.signer_role as SigRole), role];
    executed = executionState(roles).executed;
    if (executed) {
      await client.query("UPDATE contracts SET executed_at=NOW() WHERE id=$1", [k.id]);
      await client.query("UPDATE deals SET status='active', expires_at=NULL, updated_at=NOW() WHERE id=$1", [dealId]);
    }
    await client.query("INSERT INTO deal_events(deal_id, actor_id, action, from_status, to_status) VALUES ($1,$2,'sign',$3,$4)",
      [dealId, s.userId, d.status, executed ? "active" : d.status]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }

  if (executed) await notifyDeal(dealId, s.userId, "active");
  else await notifyDealParties(dealId, "A NIL agreement was signed", "One side has signed. The other side's signature is still needed.");
  redirect(`/dashboard/deals/${dealId}/contract?msg=${encodeURIComponent(executed ? "Signed — the agreement is now fully executed and the deal is active." : "Signed. Waiting for the other side.")}`);
}

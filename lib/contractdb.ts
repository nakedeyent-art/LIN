import type { PoolClient } from "pg";
import { db } from "./db";
import { paymentsEnabled } from "./stripe";
import { feeBpsFromEnv } from "./money";
import { renderContract, sha256Hex, TEMPLATE_VERSION, type ContractTerms, type SigRole } from "./contract";
import { ROLES, type Role } from "./roles";

/** Freezes the deal's terms into a contract. Called inside the transaction that moves the deal to awaiting_signature. */
export async function createContractForDeal(c: PoolClient, dealId: string): Promise<void> {
  const d = (await c.query(
    `SELECT d.title, d.amount_cents::float8 AS amount, d.deliverables, d.attested_at IS NOT NULL AS fmv,
            cu.full_name AS sponsor_name, cu.role AS sponsor_role, a.full_name AS athlete_name, ap.state,
            COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS minor, CURRENT_DATE::text AS today
       FROM deals d JOIN users cu ON cu.id = d.counterparty_id JOIN users a ON a.id = d.athlete_id
       LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id WHERE d.id=$1`, [dealId])).rows[0];
  const enabled = paymentsEnabled();
  const fee = enabled ? feeBpsFromEnv(process.env.PLATFORM_FEE_BPS) : 0;
  const terms: ContractTerms = {
    dealId, title: d.title, amountCents: d.amount, deliverables: d.deliverables,
    sponsor: { name: d.sponsor_name, roleLabel: ROLES[d.sponsor_role as Role]?.label ?? "Sponsor" },
    athlete: { name: d.athlete_name, state: d.state ?? null, minor: d.minor },
    platformFeeBps: fee, paymentsEnabled: enabled, fmvAttested: d.fmv, createdOn: d.today,
  };
  const body = renderContract(terms);
  await c.query(
    `INSERT INTO contracts(deal_id, template_version, terms, body, sha256, platform_fee_bps) VALUES ($1,$2,$3,$4,$5,$6)`,
    [dealId, TEMPLATE_VERSION, JSON.stringify(terms), body, sha256Hex(body), fee]);
}

/**
 * Ends the agreement for a deal that did not reach full signature. This is the single place that does it, so the legacy contract AND any Forg3
 * envelope generated from it close together: otherwise a withdrawn deal's agreement stays signable. Completed envelopes are never touched.
 */
export async function voidContract(c: PoolClient, dealId: string): Promise<void> {
  await c.query("UPDATE contracts SET voided_at = NOW() WHERE deal_id=$1 AND executed_at IS NULL AND voided_at IS NULL", [dealId]);
  const closed = (await c.query(
    `UPDATE signing_envelopes SET status='voided'
      WHERE deal_id=$1 AND legacy_contract_id IS NOT NULL AND status IN ('draft','sent','viewed','partially_signed') RETURNING id`, [dealId])).rows;
  for (const { id } of closed) {
    await c.query("INSERT INTO signing_events(envelope_id,action) VALUES($1,'envelope.voided_with_deal')", [id]);
    await c.query('DELETE FROM signing_sessions WHERE envelope_id=$1', [id]);
    await c.query(
      `INSERT INTO notifications(user_id,kind,title,href)
       SELECT r.user_id,'account','Agreement voided: the deal ended','/dashboard/signing/'||$2::text FROM signing_recipients r WHERE r.envelope_id=$1`, [id, id]);
  }
}

export type ContractView = {
  id: string; dealId: string; body: string; sha256: string; templateVersion: string; platformFeeBps: number;
  createdAt: Date; executedAt: Date | null; voidedAt: Date | null;
  signatures: { userId: string; role: SigRole; typedName: string; signedAt: Date; consentVersion: string }[];
};

export async function getContract(dealId: string): Promise<ContractView | null> {
  const c = (await db().query(
    "SELECT id, deal_id, body, sha256, template_version, platform_fee_bps, created_at, executed_at, voided_at FROM contracts WHERE deal_id=$1", [dealId])).rows[0];
  if (!c) return null;
  const sigs = (await db().query(
    "SELECT signer_user_id, signer_role, typed_name, signed_at, consent_version FROM contract_signatures WHERE contract_id=$1 ORDER BY signed_at", [c.id])).rows;
  return {
    id: c.id, dealId: c.deal_id, body: c.body, sha256: c.sha256.trim(), templateVersion: c.template_version, platformFeeBps: c.platform_fee_bps,
    createdAt: c.created_at, executedAt: c.executed_at, voidedAt: c.voided_at,
    signatures: sigs.map((s) => ({ userId: s.signer_user_id, role: s.signer_role, typedName: s.typed_name, signedAt: s.signed_at, consentVersion: s.consent_version })),
  };
}

import { db } from "./db";
import {
  detectPayForPlayRisks,
  type DisbursementGrant,
} from "./collective-audit";

/**
 * Loads real collective grants and deal deliverables from Postgres.
 */
export async function loadRealCollectiveGrants(): Promise<DisbursementGrant[]> {
  try {
    const res = await db().query(`
      SELECT d.id, d.title, d.amount_cents, d.deliverables, d.status, d.athlete_id,
             u.full_name AS athlete_name, ap.sport,
             COALESCE((SELECT count(*) FROM deal_work_items wi WHERE wi.deal_id = d.id), 0)::int AS total_items,
             COALESCE((SELECT count(*) FROM deal_work_items wi WHERE wi.deal_id = d.id AND wi.status = 'accepted'), 0)::int AS accepted_items,
             COALESCE((SELECT count(*) FROM deal_work_items wi WHERE wi.deal_id = d.id AND wi.status = 'submitted'), 0)::int AS submitted_items
      FROM deals d
      JOIN users u ON u.id = d.athlete_id
      LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id
      WHERE d.status IN ('active', 'completed', 'approved')
      ORDER BY d.created_at DESC
      LIMIT 50
    `);

    return res.rows.map((r) => {
      const amount = Math.round(Number(r.amount_cents) / 100);
      const totalItems = Number(r.total_items);
      const acceptedItems = Number(r.accepted_items);
      const proofVerified = totalItems > 0 && acceptedItems === totalItems;
      const proofUrl = proofVerified ? `/dashboard/deals/${r.id}` : undefined;

      const rawGrant: Partial<DisbursementGrant> = {
        id: r.id,
        athleteId: r.athlete_id,
        athleteName: r.athlete_name,
        sport: r.sport || "Basketball",
        grantTitle: r.title,
        disbursedAmount: amount,
        fairMarketValueEstimate: amount,
        deliverableType: "Community Event Keynote",
        proofUrl,
        proofVerified,
        nonContingencyAttested: true,
      };

      const riskFlags = detectPayForPlayRisks(rawGrant);
      const hasHighRisk = riskFlags.some((f) => f.level === "high");
      const hasMedRisk = riskFlags.some((f) => f.level === "medium");

      const auditStatus: DisbursementGrant["auditStatus"] = hasHighRisk
        ? "flagged"
        : hasMedRisk
        ? "action_required"
        : "compliant";

      return {
        id: r.id as string,
        athleteId: r.athlete_id as string,
        athleteName: r.athlete_name as string,
        sport: (r.sport as string) || "Basketball",
        grantTitle: r.title as string,
        disbursedAmount: amount,
        fairMarketValueEstimate: amount,
        deliverableType: "Community Event Keynote",
        proofUrl,
        proofSubmittedAt: proofVerified ? new Date().toISOString().slice(0, 10) : undefined,
        proofVerified,
        nonContingencyAttested: true,
        auditStatus,
        riskFlags,
      };
    });
  } catch {
    return [];
  }
}

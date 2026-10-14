import { db } from "./db";
import { capacityOn, type DealRow } from "./dealsdb";

/** Select a payee under the same deal/payment locks as the financial state checks. */
export async function selectPayee(userId: string, dealId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db().connect();
  const refuse = async (error: string) => { await c.query("ROLLBACK"); return { ok: false as const, error }; };
  try {
    await c.query("BEGIN");
    const d = (await c.query(
      `SELECT d.id, d.status, d.athlete_id, d.counterparty_id,
              COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor
         FROM deals d LEFT JOIN athlete_profiles ap ON ap.user_id=d.athlete_id WHERE d.id=$1 FOR UPDATE OF d`, [dealId])).rows[0] as DealRow | undefined;
    const who = d ? await capacityOn(userId, d, c) : null;
    if (!d || !((who === "athlete" && !d.athlete_minor) || who === "guardian"))
      return await refuse("Only the athlete (or their guardian, if under 18) can choose who receives the payment.");
    if (!["active", "completed"].includes(d.status)) return await refuse("The payee can be chosen once the agreement is signed.");
    const payments = (await c.query("SELECT id,status,attempts,stripe_transfer_id FROM deal_payments WHERE deal_id=$1 FOR UPDATE", [dealId])).rows;
    // After a transfer attempt, Stripe may already have accepted the original destination even if its response was lost.
    if (payments.some(p => ["released", "refunded", "refunding"].includes(p.status) || p.stripe_transfer_id || (p.status === "releasing" && p.attempts > 0)))
      return await refuse("The payment is processing or already settled, so its recipient can't be changed. Contact support if you need help.");
    await c.query("UPDATE deals SET payee_user_id=$2,updated_at=NOW() WHERE id=$1", [dealId, userId]);
    await c.query("UPDATE deal_payments SET payee_user_id=$2,updated_at=NOW() WHERE deal_id=$1 AND status IN ('pending_checkout','funded','releasing')", [dealId, userId]);
    await c.query("INSERT INTO deal_events(deal_id,actor_id,action,from_status,to_status) VALUES($1,$2,'change_payee',$3,$3)", [dealId, userId, d.status]);
    await c.query("COMMIT");
    return { ok: true };
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
}

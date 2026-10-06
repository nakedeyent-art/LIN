import type { PoolClient } from "pg";
import { db } from "./db";

type Q = Pick<PoolClient, "query">;

/**
 * Is messaging between this athlete's side and this counterparty switched off?
 * Blocked if either person blocked the other, or a CURRENT guardian blocked the counterparty on a minor's behalf.
 */
export const BLOCKED_SQL = (athleteCol: string, cpCol: string) => `EXISTS (SELECT 1 FROM user_blocks b WHERE
    (b.blocker_id = ${athleteCol} AND b.blocked_id = ${cpCol})
 OR (b.blocker_id = ${cpCol} AND b.blocked_id = ${athleteCol})
 OR (b.athlete_id = ${athleteCol} AND b.blocked_id = ${cpCol}
     AND EXISTS (SELECT 1 FROM guardian_links g WHERE g.athlete_id = ${athleteCol} AND g.member_id = b.blocker_id)))`;

export async function pairBlocked(athleteId: string, counterpartyId: string, c: Q = db()): Promise<boolean> {
  return !!(await c.query(`SELECT 1 WHERE ${BLOCKED_SQL("$1::uuid", "$2::uuid")}`, [athleteId, counterpartyId])).rowCount;
}

export type BlockState = { blocked: boolean; byMe: boolean; canLift: boolean };

/** What the viewer should see: whether the pair is blocked, whether they set it (or may lift it), without revealing the other side's block. */
export async function blockState(d: { athlete_id: string; counterparty_id: string; athlete_minor: boolean }, viewerId: string, who: "counterparty" | "athlete" | "guardian"): Promise<BlockState> {
  const blocked = await pairBlocked(d.athlete_id, d.counterparty_id);
  if (!blocked) return { blocked: false, byMe: false, canLift: false };
  const mine = (await db().query(
    `SELECT 1 FROM user_blocks b WHERE
       (b.blocker_id = $1 AND b.blocked_id IN ($2,$3))
    OR (b.athlete_id = $2 AND b.blocked_id = $3 AND $4 = 'guardian')`, [viewerId, d.athlete_id, d.counterparty_id, who])).rowCount! > 0;
  // A minor can block for their own safety, but only a guardian can lift a block that protects them.
  const canLift = mine && !(who === "athlete" && d.athlete_minor) || (who === "guardian" && (await athleteSideBlocks(d)));
  return { blocked, byMe: mine, canLift };
}
async function athleteSideBlocks(d: { athlete_id: string; counterparty_id: string }): Promise<boolean> {
  return !!(await db().query(
    `SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=$2) OR (b.athlete_id=$1 AND b.blocked_id=$2)`, [d.athlete_id, d.counterparty_id])).rowCount;
}

/** Who the viewer would be blocking on this deal: the other party for the buyer, the counterparty for the athlete side. */
export async function addBlock(d: { athlete_id: string; counterparty_id: string }, viewerId: string, who: "counterparty" | "athlete" | "guardian"): Promise<void> {
  const target = who === "counterparty" ? d.athlete_id : d.counterparty_id;
  await db().query(
    "INSERT INTO user_blocks(blocker_id, blocked_id, athlete_id) VALUES ($1,$2,$3) ON CONFLICT (blocker_id, blocked_id) DO NOTHING",
    [viewerId, target, who === "guardian" ? d.athlete_id : null]);
}

export async function liftBlock(d: { athlete_id: string; counterparty_id: string; athlete_minor: boolean }, viewerId: string, who: "counterparty" | "athlete" | "guardian"): Promise<boolean> {
  if (who === "counterparty") return !!(await db().query("DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", [viewerId, d.athlete_id])).rowCount;
  if (who === "athlete") {
    if (d.athlete_minor) return false;
    return !!(await db().query("DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", [viewerId, d.counterparty_id])).rowCount;
  }
  // a current guardian may lift any block that protects the minor (their own, another guardian's, or the minor's)
  return !!(await db().query("DELETE FROM user_blocks WHERE blocked_id=$2 AND (blocker_id=$1 OR athlete_id=$1)", [d.athlete_id, d.counterparty_id])).rowCount;
}

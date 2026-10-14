import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { selectPayee } from "../lib/payee";
import { releasePayment } from "../lib/payments";

let athlete: string, sponsor: string, deal: string, payment: string;
beforeEach(async () => {
  await db().query("TRUNCATE users CASCADE");
  athlete = (await db().query("INSERT INTO users(email,full_name,role,password_hash) VALUES('athlete@example.test','Athlete','athlete','test-only') RETURNING id")).rows[0].id;
  sponsor = (await db().query("INSERT INTO users(email,full_name,role,password_hash) VALUES('sponsor@example.test','Sponsor','sponsor','test-only') RETURNING id")).rows[0].id;
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college','2000-01-01')", [athlete]);
  deal = (await db().query("INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,payee_user_id) VALUES($1,$2,'Test deal',10000,'Test deliverables','completed',$2) RETURNING id", [athlete, sponsor])).rows[0].id;
  payment = (await db().query("INSERT INTO deal_payments(deal_id,payee_user_id,amount_cents,fee_cents,status) VALUES($1,$2,10000,0,'funded') RETURNING id", [deal, sponsor])).rows[0].id;
});
afterAll(async () => { await db().end(); });
describe("payment recipient changes", () => {
  it("updates held funds and leaves an audit entry", async () => {
    expect(await selectPayee(athlete, deal)).toEqual({ ok: true });
    expect((await db().query("SELECT payee_user_id FROM deal_payments WHERE id=$1", [payment])).rows[0].payee_user_id).toBe(athlete);
    expect((await db().query("SELECT action FROM deal_events WHERE deal_id=$1", [deal])).rows).toEqual([{ action: "change_payee" }]);
  });
  it("allows repairing a payee before any transfer attempt", async () => {
    await db().query("UPDATE deal_payments SET status='releasing',attempts=0 WHERE id=$1", [payment]);
    expect(await selectPayee(athlete, deal)).toEqual({ ok: true });
  });
  it.each(["released", "refunded", "refunding"])("refuses a %s payment, including a crafted direct request", async status => {
    await db().query("UPDATE deal_payments SET status=$2 WHERE id=$1", [payment, status]);
    expect(await selectPayee(athlete, deal)).toHaveProperty("ok", false);
    expect((await db().query("SELECT payee_user_id FROM deals WHERE id=$1", [deal])).rows[0].payee_user_id).toBe(sponsor);
  });
  it("waits for the payment lock and refuses a concurrently started transfer", async () => {
    const c = await db().connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT 1 FROM deal_payments WHERE id=$1 FOR UPDATE", [payment]);
      const changing = selectPayee(athlete, deal);
      await c.query("UPDATE deal_payments SET status='releasing',attempts=1 WHERE id=$1", [payment]);
      await c.query("COMMIT");
      expect(await changing).toHaveProperty("ok", false);
      expect((await db().query("SELECT payee_user_id FROM deals WHERE id=$1", [deal])).rows[0].payee_user_id).toBe(sponsor);
    } finally { await c.query("ROLLBACK"); c.release(); }
  });
  it("rejects a sponsor who tries to become the payee", async () => {
    expect(await selectPayee(sponsor, deal)).toHaveProperty("ok", false);
  });
  it("rejects a minor acting without their guardian", async () => {
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '16 years' WHERE user_id=$1", [athlete]);
    expect(await selectPayee(athlete, deal)).toHaveProperty("ok", false);
  });
});

describe("release during a dispute", () => {
  it("is refused while a dispute is open and not because of a missing payment", async () => {
    await db().query("INSERT INTO payment_events(payment_id,action,created_at) VALUES($1,'dispute_opened',now()-interval '1 hour')", [payment]);
    expect(await releasePayment(payment)).toEqual({ ok: false, error: "payment is under dispute" });
    await db().query("INSERT INTO payment_events(payment_id,action) VALUES($1,'dispute_closed')", [payment]);
    expect((await releasePayment(payment)).error).not.toBe("payment is under dispute");
  });
});

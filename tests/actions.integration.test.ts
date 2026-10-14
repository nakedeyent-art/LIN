import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import { hashToken } from "../lib/crypto";
import { createOffer, dealAction } from "../app/dashboard/deals/actions";
import { signContract } from "../app/dashboard/deals/contract-actions";
import { claimPayee, fundDeal, startPayouts } from "../app/dashboard/deals/payment-actions";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "actor" }) }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("../lib/stripe", async original => ({ ...await original<typeof import("../lib/stripe")>(), paymentsEnabled: () => true }));
vi.mock("../lib/dealsdb", async original => ({ ...await original<typeof import("../lib/dealsdb")>(), notifyDeal: vi.fn() }));

let actor: string, athlete: string, deal: string;
const form = (values: Record<string, string>) => { const f = new FormData(); for (const [key, value] of Object.entries(values)) f.set(key, value); return f; };
beforeEach(async () => {
  await db().query("TRUNCATE users CASCADE");
  actor = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('actor@example.test','Test Sponsor','sponsor','test-only',NOW()) RETURNING id")).rows[0].id;
  athlete = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('athlete@example.test','Test Athlete','athlete','test-only',NOW()) RETURNING id")).rows[0].id;
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date,discoverable) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '16 years',TRUE)", [athlete]);
  const guardian = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('guardian@example.test','Test Guardian','parent','test-only',NOW()) RETURNING id")).rows[0].id;
  await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',TRUE)", [athlete, guardian]);
  await db().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 day')", [hashToken("actor"), actor]);
  deal = (await db().query("INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status) VALUES($1,$2,'Test offer',10000,'Safe deliverable description','active') RETURNING id", [athlete, actor])).rows[0].id;
});
afterAll(async () => { await db().end(); });

describe("financial Server Actions enforce MFA before changing anything", () => {
  it.each(["approve", "complete", "request_cancel", "agree_cancel"])("guards the %s transition", async action => {
    await expect(dealAction(form({ deal_id: deal, action }))).rejects.toThrow("REDIRECT /mfa/setup?");
    expect((await db().query("SELECT status FROM deals WHERE id=$1", [deal])).rows[0].status).toBe("active");
  });
  it("guards contract signatures", async () => {
    await expect(signContract(form({ deal_id: deal, consent: "on", typed_name: "Test Sponsor" }))).rejects.toThrow("REDIRECT /mfa/setup?");
    expect((await db().query("SELECT count(*)::int AS n FROM contract_signatures")).rows[0].n).toBe(0);
  });
  it("guards funding and recipient changes", async () => {
    await expect(fundDeal(form({ deal_id: deal }))).rejects.toThrow("REDIRECT /mfa/setup?");
    await expect(claimPayee(form({ deal_id: deal }))).rejects.toThrow("REDIRECT /mfa/setup?");
    expect((await db().query("SELECT count(*)::int AS n FROM deal_payments")).rows[0].n).toBe(0);
  });
  it("guards payout setup for an eligible adult athlete", async () => {
    await db().query("UPDATE users SET role='athlete' WHERE id=$1", [actor]);
    await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college','2000-01-01')", [actor]);
    await expect(startPayouts()).rejects.toThrow("REDIRECT /mfa/setup?");
    expect((await db().query("SELECT count(*)::int AS n FROM payout_accounts")).rows[0].n).toBe(0);
  });
  it("rejects a sponsor attempting payout setup without widening their role", async () => {
    await expect(startPayouts()).rejects.toThrow("REDIRECT /dashboard/deals?error=");
    expect((await db().query("SELECT count(*)::int AS n FROM payout_accounts")).rows[0].n).toBe(0);
  });
});

describe("offers cannot bypass youth safety or concurrent limits", () => {
  const offer = (title: string, deliverables: string) => form({ athlete_id: athlete, title, deliverables, amount: "100", attest: "on" });
  it.each([
    ["Camp offer", "Please contact scout@example.com to arrange this appearance."],
    ["Visit www.example.com", "Attend our supervised community event for two hours."],
    ["Camp offer", "Please send us nudes before the event takes place."],
    ["Camp offer", "We will pay you directly through Venmo for this appearance."],
  ])("screens title and terms before storing an offer: %s", async (title, deliverables) => {
    await expect(createOffer(offer(title, deliverables))).rejects.toThrow("REDIRECT /dashboard/deals/new?");
    expect((await db().query("SELECT count(*)::int AS n FROM deals WHERE status='offered'")).rows[0].n).toBe(0);
  });
  it("enforces the three-offer limit across concurrent submissions", async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => createOffer(offer(`Camp ${i}`, "Attend our supervised community event for two hours."))));
    // All actions redirect; exactly three reach a new deal and the remainder return to the offer form.
    expect(results.filter(r => r.status === "rejected" && /REDIRECT \/dashboard\/deals\/[0-9a-f-]{36}\?msg=/.test(String(r.reason)))).toHaveLength(3);
    expect((await db().query("SELECT count(*)::int AS n FROM deals WHERE status='offered'")).rows[0].n).toBe(3);
  });
});

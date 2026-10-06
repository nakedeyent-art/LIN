import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adultOn, authorizeCron, classify, MAX_ATTEMPTS, shouldGiveUp, STALE_DAYS } from "./adulthood";
import { athleteAdultEmail, guardianAdultEmail } from "./adult-emails";

describe("adultOn", () => {
  it("is the 18th birthday", () => {
    expect(adultOn("2008-10-05")).toBe("2026-10-05");
    expect(adultOn("2008-01-31")).toBe("2026-01-31");
  });
  it("Feb 29 births become adult on Mar 1 (matches the SQL rule)", () => {
    expect(adultOn("2008-02-29")).toBe("2026-03-01");
    expect(adultOn("2004-02-29")).toBe("2022-03-01");
    expect(adultOn("2008-02-28")).toBe("2026-02-28");
  });
});

describe("classify", () => {
  const birth = "2008-10-05"; // adult on 2026-10-05
  it("sends for a minor-era account on/just after the birthday", () => {
    expect(classify(birth, "2024-01-01", "2026-10-05")).toBe("send");
    expect(classify(birth, "2024-01-01", "2026-10-20")).toBe("send");
  });
  it("sends right up to the stale boundary, skips after it", () => {
    expect(classify(birth, "2024-01-01", `2026-11-04`)).toBe("send");            // exactly STALE_DAYS (30) later
    expect(classify(birth, "2024-01-01", "2026-11-05")).toBe("skip_stale");      // 31 days
    expect(STALE_DAYS).toBe(30);
  });
  it("never emails someone who joined already 18+", () => {
    expect(classify(birth, "2026-10-05", "2026-10-06")).toBe("skip_adult_at_signup");   // signed up on the birthday
    expect(classify(birth, "2027-01-01", "2027-01-02")).toBe("skip_adult_at_signup");
  });
  it("signing up the day before turning 18 still counts as a minor-era account", () => {
    expect(classify(birth, "2026-10-04", "2026-10-05")).toBe("send");
  });
});

describe("retry policy", () => {
  it("gives up at the cap", () => {
    expect(shouldGiveUp(MAX_ATTEMPTS - 1)).toBe(false);
    expect(shouldGiveUp(MAX_ATTEMPTS)).toBe(true);
  });
});

describe("authorizeCron", () => {
  const dg = (s: string) => createHash("sha256").update(s).digest("hex");
  const secret = "a-sufficiently-long-secret-123";
  it("refuses to run when the secret is missing or short", () => {
    expect(authorizeCron(`Bearer ${secret}`, undefined, dg)).toBe("unconfigured");
    expect(authorizeCron("Bearer short", "short", dg)).toBe("unconfigured");
    expect(authorizeCron(null, "", dg)).toBe("unconfigured");
  });
  it("accepts only the exact bearer secret", () => {
    expect(authorizeCron(`Bearer ${secret}`, secret, dg)).toBe("ok");
    for (const bad of [null, "", secret, `bearer ${secret}`, `Bearer ${secret}x`, `Bearer ${secret.slice(1)}`, "Bearer ", "Basic abc"])
      expect(authorizeCron(bad, secret, dg)).toBe("denied");
  });
});

describe("email copy", () => {
  const app = "https://app.example";
  it("athlete email explains the change and links to the Team page", () => {
    const m = athleteAdultEmail({ name: "Jordan", pendingDeals: 0, appUrl: app });
    expect(m.subject).toMatch(/18/);
    expect(m.text).toContain("Hi Jordan");
    expect(m.text).toContain(`${app}/dashboard/team`);
    expect(m.text).not.toMatch(/waiting for a guardian/);
  });
  it("mentions pending deals with correct pluralisation, never amounts or emails", () => {
    expect(athleteAdultEmail({ name: "J", pendingDeals: 1, appUrl: app }).text).toMatch(/1 deal was waiting/);
    expect(athleteAdultEmail({ name: "J", pendingDeals: 3, appUrl: app }).text).toMatch(/3 deals were waiting/);
    const g = guardianAdultEmail({ guardianName: "Maria", athleteName: "Jordan", pendingDeals: 2, appUrl: app });
    expect(g.text).toMatch(/2 deals were waiting/);
    expect(g.text).not.toMatch(/\$|@/);
  });
  it("guardian email says authority ended", () => {
    const g = guardianAdultEmail({ guardianName: "Maria", athleteName: "Jordan", pendingDeals: 0, appUrl: app });
    expect(g.subject).toBe("Jordan turned 18 on LIN");
    expect(g.text).toMatch(/guardian role on LIN has ended/);
  });
});

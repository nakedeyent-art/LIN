import { describe, expect, it } from "vitest";
import { DEFAULT_OPPORTUNITIES, filterOpportunities } from "./campaigns";

describe("NIL Campaign Marketplace Filtering", () => {
  it("returns all campaigns when no filter criteria are specified", () => {
    const res = filterOpportunities(DEFAULT_OPPORTUNITIES, {});
    expect(res.length).toBe(DEFAULT_OPPORTUNITIES.length);
  });

  it("filters by sport accurately, including 'All Sports' opportunities", () => {
    const bballOnly = filterOpportunities(DEFAULT_OPPORTUNITIES, { sport: "Basketball" });
    // Should include basketball-specific campaigns AND all-sports campaigns
    expect(bballOnly.some((c) => c.sport === "Basketball")).toBe(true);
    expect(bballOnly.every((c) => c.sport === "Basketball" || c.sport === "All Sports")).toBe(true);
  });

  it("filters by category", () => {
    const social = filterOpportunities(DEFAULT_OPPORTUNITIES, { category: "Social Media" });
    expect(social.every((c) => c.category === "Social Media")).toBe(true);
    expect(social.length).toBeGreaterThan(0);
  });

  it("safeguards minors by excluding 'College Only' campaigns", () => {
    const collegeDeals = DEFAULT_OPPORTUNITIES.filter((c) => c.level === "College Only");
    expect(collegeDeals.length).toBeGreaterThan(0);

    const minorEligible = filterOpportunities(DEFAULT_OPPORTUNITIES, { isMinor: true });
    expect(minorEligible.some((c) => c.level === "College Only")).toBe(false);
  });

  it("filters by keyword search across title, sponsor, and deliverables", () => {
    const searchReels = filterOpportunities(DEFAULT_OPPORTUNITIES, { searchTerm: "Reels" });
    expect(searchReels.length).toBeGreaterThan(0);
    expect(searchReels.every((c) => c.deliverables.toLowerCase().includes("reels"))).toBe(true);

    const searchApex = filterOpportunities(DEFAULT_OPPORTUNITIES, { searchTerm: "Apex" });
    expect(searchApex.length).toBe(1);
    expect(searchApex[0].sponsorName).toContain("Apex");
  });
});

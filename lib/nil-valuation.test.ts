import { describe, expect, it } from "vitest";
import {
  calculateDeliverablesPricing,
  calculateTaxBreakdown,
  generateMediaKitText,
  STATE_RATES,
} from "./nil-valuation";

describe("NIL Deliverable Pricing & Valuation", () => {
  it("calculates realistic deliverable pricing based on reach and engagement", () => {
    const reach = {
      igFollowers: 10000,
      tiktokFollowers: 15000,
      xFollowers: 5000,
      engagementRate: 4.0, // baseline
    };
    const pricing = calculateDeliverablesPricing(reach);
    expect(pricing.totalReach).toBe(30000);
    expect(pricing.engagementFactor).toBe(1.0);
    // Reel: totalReach * 0.035 * 1.0 = 1050 rounded to 25
    expect(pricing.reelPrice).toBe(1050);
    // Static post: 10000 * 0.025 * 1.0 = 250
    expect(pricing.staticPostPrice).toBe(250);
    // Story series: 10000 * 0.015 * 1.0 = 150
    expect(pricing.storySeriesPrice).toBe(150);
    // Appearance: 250 + 30000 * 0.02 = 850
    expect(pricing.appearancePrice).toBe(850);
    // Monthly Retainer: 1050 * 2 + 150 * 3 + 200 = 2100 + 450 + 200 = 2750 -> 2800 rounded to 100
    expect(pricing.monthlyRetainerPrice).toBe(2800);
  });

  it("enforces minimum floor prices for emerging athletes with low reach", () => {
    const microAthlete = {
      igFollowers: 200,
      tiktokFollowers: 100,
      xFollowers: 50,
      engagementRate: 2.0,
    };
    const pricing = calculateDeliverablesPricing(microAthlete);
    expect(pricing.reelPrice).toBeGreaterThanOrEqual(150);
    expect(pricing.staticPostPrice).toBeGreaterThanOrEqual(100);
    expect(pricing.storySeriesPrice).toBeGreaterThanOrEqual(75);
    expect(pricing.appearancePrice).toBeGreaterThanOrEqual(300);
    expect(pricing.monthlyRetainerPrice).toBeGreaterThanOrEqual(500);
  });

  it("scales pricing when engagement rate is exceptionally high", () => {
    const highEngagement = {
      igFollowers: 10000,
      tiktokFollowers: 10000,
      xFollowers: 0,
      engagementRate: 8.0, // 2x baseline
    };
    const standard = {
      igFollowers: 10000,
      tiktokFollowers: 10000,
      xFollowers: 0,
      engagementRate: 4.0,
    };
    const pHigh = calculateDeliverablesPricing(highEngagement);
    const pStd = calculateDeliverablesPricing(standard);
    expect(pHigh.reelPrice).toBeGreaterThan(pStd.reelPrice);
    expect(pHigh.staticPostPrice).toBeGreaterThan(pStd.staticPostPrice);
  });

  it("generates formatted media kit text with correct deliverables and FTC notes", () => {
    const reach = {
      igFollowers: 5000,
      tiktokFollowers: 10000,
      xFollowers: 1000,
      engagementRate: 5.2,
    };
    const pricing = calculateDeliverablesPricing(reach);
    const text = generateMediaKitText({
      athleteName: "Maya Moore",
      sport: "Basketball",
      position: "Forward",
      level: "NCAA_D1",
      reach,
      pricing,
    });
    expect(text).toContain("NIL BRAND RATE CARD & MEDIA KIT");
    expect(text).toContain("Maya Moore");
    expect(text).toContain("Basketball · Forward");
    expect(text).toContain("16,000 followers");
    expect(text).toContain("FTC disclosure compliance");
  });
});

describe("1099 Self-Employment Tax Estimator", () => {
  it("calculates accurate SE tax and zero state tax for Florida / Texas", () => {
    const res = calculateTaxBreakdown(10000, "FL", 15);
    expect(res.gross).toBe(10000);
    expect(res.agentFee).toBe(1500);
    expect(res.netBeforeTax).toBe(8500);

    // SE tax: 8500 * 0.9235 * 0.153 = ~1201.01
    expect(res.seTax).toBeCloseTo(1201.01, 1);
    expect(res.stateTax).toBe(0); // Florida has no state income tax
    expect(res.quarterlyEstimatedTax).toBeCloseTo(res.totalTaxes / 4, 1);
  });

  it("applies state income tax in California (8%) and New York (6.5%)", () => {
    const ca = calculateTaxBreakdown(20000, "CA", 0);
    expect(ca.stateTax).toBe(20000 * 0.08); // $1,600

    const ny = calculateTaxBreakdown(20000, "NY", 0);
    expect(ny.stateTax).toBe(20000 * 0.065); // $1,300
  });

  it("handles zero or negative gross safely", () => {
    const res = calculateTaxBreakdown(0, "FL", 15);
    expect(res.gross).toBe(0);
    expect(res.totalTaxes).toBe(0);
    expect(res.netTakeHome).toBe(0);
    expect(res.recommendedReservePct).toBe(30); // fallback reserve
  });

  it("includes all defined states in STATE_RATES", () => {
    expect(STATE_RATES.some((s) => s.code === "FL")).toBe(true);
    expect(STATE_RATES.some((s) => s.code === "TX")).toBe(true);
    expect(STATE_RATES.some((s) => s.code === "CA")).toBe(true);
    expect(STATE_RATES.some((s) => s.code === "NY")).toBe(true);
  });
});

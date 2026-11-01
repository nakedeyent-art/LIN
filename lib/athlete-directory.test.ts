import { describe, expect, it } from "vitest";
import {
  SAMPLE_ATHLETE_DIRECTORY,
  filterAthletes,
  getAvailableSports,
  getAvailableStates,
  getAthleteStats,
  buildCredentialForDirectoryAthlete,
} from "./athlete-directory";

describe("athlete-directory domain logic", () => {
  it("filters by sport accurately", () => {
    const fb = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { sport: "Football" });
    expect(fb.length).toBeGreaterThan(0);
    expect(fb.every((a) => a.sport === "Football")).toBe(true);
  });

  it("filters by level (high_school vs college)", () => {
    const hs = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { level: "high_school" });
    expect(hs.every((a) => a.level === "high_school")).toBe(true);

    const col = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { level: "college" });
    expect(col.every((a) => a.level === "college")).toBe(true);
  });

  it("filters by state and search query", () => {
    const ca = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { state: "CA" });
    expect(ca.every((a) => a.state === "CA")).toBe(true);

    const searched = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { searchQuery: "Brooks" });
    expect(searched.length).toBe(1);
    expect(searched[0].fullName).toBe("Devon Brooks");
  });

  it("filters by minor status and valuation range", () => {
    const minors = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { minorStatus: "minor_only" });
    expect(minors.every((a) => a.isMinor)).toBe(true);

    const highVal = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { minValuation: 1000 });
    expect(highVal.every((a) => a.fairMarketValueDollars >= 1000)).toBe(true);
  });

  it("sorts by valuation descending", () => {
    const sorted = filterAthletes(SAMPLE_ATHLETE_DIRECTORY, { sortBy: "valuation_desc" });
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].fairMarketValueDollars).toBeGreaterThanOrEqual(sorted[i].fairMarketValueDollars);
    }
  });

  it("aggregates directory stats correctly", () => {
    const stats = getAthleteStats(SAMPLE_ATHLETE_DIRECTORY);
    expect(stats.total).toBe(SAMPLE_ATHLETE_DIRECTORY.length);
    expect(stats.highSchoolCount + stats.collegeCount).toBe(stats.total);
    expect(stats.verifiedPassCount).toBeGreaterThan(0);
    expect(stats.avgFollowers).toBeGreaterThan(0);
    expect(stats.avgER).toBeGreaterThan(0);
  });

  it("extracts unique sports and states", () => {
    const sports = getAvailableSports(SAMPLE_ATHLETE_DIRECTORY);
    expect(sports).toContain("All");
    expect(sports).toContain("Football");
    expect(sports).toContain("Basketball");

    const states = getAvailableStates(SAMPLE_ATHLETE_DIRECTORY);
    expect(states).toContain("All");
    expect(states).toContain("FL");
    expect(states).toContain("CA");
  });

  it("generates a cryptographically verifiable credential for a directory athlete", () => {
    const athlete = SAMPLE_ATHLETE_DIRECTORY[0];
    const cred = buildCredentialForDirectoryAthlete(athlete);
    expect(cred.athlete.athleteName).toBe("Devon Brooks");
    expect(cred.athlete.institutionOrSchool).toBe("University of Miami");
    expect(cred.digitalSignatureSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(cred.badges.amateurismEligibility).toBe("NCAA_COMPLIANT");
    expect(cred.rateCard.socialMediaPostDollars).toBe(1200);
  });
});

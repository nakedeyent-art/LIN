import { describe, expect, it } from "vitest";
import { classify, parseFilter, plainText } from "./news";

describe("classify", () => {
  it("tags the categories the product cares about", () => {
    expect(classify("Preseason rankings: new No. 1 in the nation").categories).toContain("rankings");
    expect(classify("Four-star guard to reclassify to 2026").categories).toContain("reclassification");
    expect(classify("Senior day: 12 graduating players honoured").categories).toContain("graduating_seniors");
    expect(classify("Star QB signs with Ohio State on signing day").categories).toContain("graduating_seniors");
    expect(classify("Linebacker will redshirt this season").categories).toContain("redshirt");
    expect(classify("Medical hardship granted for extra year of eligibility").categories).toContain("redshirt");
    expect(classify("Another state championship for the perennial powerhouse").categories).toContain("powerhouse");
  });
  it("can carry several categories, and falls back to general", () => {
    const c = classify("Powerhouse's senior class tops the rankings").categories;
    expect(c).toEqual(expect.arrayContaining(["powerhouse", "graduating_seniors", "rankings"]));
    expect(classify("Coach announces new training facility").categories).toEqual(["general"]);
  });
  it("detects level, sport and honours source hints", () => {
    expect(classify("High school football: state playoffs begin").level).toBe("high_school");
    expect(classify("NCAA basketball conference tournament preview").level).toBe("college");
    expect(classify("High school transfer portal chatter for NCAA hopefuls").level).toBeNull();
    expect(classify("Big game tonight", "", { level: "high_school" }).level).toBe("high_school");
    expect(classify("Volleyball team wins").sport).toBe("volleyball");
    expect(classify("Big game", "", { sport: "Soccer" }).sport).toBe("soccer");
  });
  it("does not match inside other words", () => {
    expect(classify("Pollen count high; seniority rules").categories).toEqual(["general"]);
  });
});
describe("parseFilter", () => {
  const p = (o: Record<string, string[]>) => parseFilter((k) => o[k] ?? []);
  it("keeps only known values", () => {
    const f = p({ cat: ["rankings", "bogus"], level: ["college", "x"], sport: ["Football", "curling"], q: ["  hello\n  world "], days: ["7"] });
    expect(f).toEqual({ categories: ["rankings"], levels: ["college"], sports: ["football"], q: "hello world", days: 7 });
  });
  it("defaults and bounds", () => {
    expect(p({}).days).toBe(30);
    expect(p({ days: ["9999"] }).days).toBe(30);
    expect(p({ q: ["x".repeat(500)] }).q.length).toBe(80);
  });
});
describe("plainText", () => {
  it("strips markup, decodes basics, truncates", () => {
    expect(plainText("<p>Fish &amp; <b>chips</b></p>", 50)).toBe("Fish & chips");
    expect(plainText("<script>alert(1)</script>ok", 50)).toBe("alert(1) ok");
    expect(plainText("x".repeat(400), 300).length).toBe(300);
  });
});

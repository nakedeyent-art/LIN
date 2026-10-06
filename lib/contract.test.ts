import { describe, expect, it } from "vitest";
import { canSign, executionState, nameMatches, normalizeName, renderContract, renderSignaturePage, sha256Hex, type ContractTerms } from "./contract";

const terms: ContractTerms = {
  dealId: "11111111-2222-3333-4444-555555555555", title: "Social ambassador", amountCents: 150000,
  deliverables: "Two Instagram posts and one in-store appearance in November.\nTag the brand.",
  sponsor: { name: "Sam Sponsor", roleLabel: "Sponsor" }, athlete: { name: "Ada Adult", state: "TX", minor: false },
  platformFeeBps: 500, paymentsEnabled: true, fmvAttested: true, createdOn: "2026-10-06",
};

describe("renderContract", () => {
  it("is deterministic: same terms → identical text and hash", () => {
    expect(renderContract(terms)).toBe(renderContract({ ...terms }));
    expect(sha256Hex(renderContract(terms))).toBe(sha256Hex(renderContract({ ...terms })));
    expect(sha256Hex(renderContract(terms))).toMatch(/^[0-9a-f]{64}$/);
  });
  it("any change to the terms changes the hash", () => {
    const base = sha256Hex(renderContract(terms));
    for (const change of [{ amountCents: 150001 }, { deliverables: terms.deliverables + " Plus a story." }, { platformFeeBps: 0 }, { createdOn: "2026-10-07" }, { athlete: { ...terms.athlete, name: "Ada Adulte" } }, { sponsor: { name: "Sam Sponsors", roleLabel: "Sponsor" } }])
      expect(sha256Hex(renderContract({ ...terms, ...change }))).not.toBe(base);
    // whitespace around the deliverables isn't substance: the text (and hash) stay identical
    expect(sha256Hex(renderContract({ ...terms, deliverables: terms.deliverables + "  \n" }))).toBe(base);
  });
  it("states the money, parties, deliverables and fee", () => {
    const t = renderContract(terms);
    expect(t).toContain("$1,500.00");
    expect(t).toContain("Sponsor: Sam Sponsor");
    expect(t).toContain("Athlete: Ada Adult.");
    expect(t).toContain("Two Instagram posts");
    expect(t).toContain("5% of the Compensation");
    expect(t).toContain("State of TX");
  });
  it("minor agreements add a guardian clause; adult ones add an age confirmation", () => {
    const minor = renderContract({ ...terms, athlete: { name: "Jordan Reyes", state: null, minor: true } });
    expect(minor).toMatch(/Parent\/Legal Guardian: the linked guardian who signs below/);
    expect(minor).toContain("6. MINOR ATHLETE");
    expect(minor).toContain("Athlete's state of residence");
    expect(renderContract(terms)).toContain("at least 18 years old");
  });
  it("with payments off it says the agreement doesn't move money", () => {
    expect(renderContract({ ...terms, paymentsEnabled: false })).toMatch(/does not itself move money/);
  });
});

describe("executionState", () => {
  it("needs the sponsor and the athlete's side", () => {
    expect(executionState([]).executed).toBe(false);
    expect(executionState(["counterparty"])).toEqual({ buyer: true, athleteSide: false, executed: false });
    expect(executionState(["athlete"]).executed).toBe(false);
    expect(executionState(["counterparty", "athlete"]).executed).toBe(true);
    expect(executionState(["guardian", "counterparty"]).executed).toBe(true);
    expect(executionState(["guardian", "athlete"]).executed).toBe(false);   // no sponsor
  });
});

describe("canSign", () => {
  const base = { who: "counterparty" as const, athleteIsMinor: false, status: "awaiting_signature" as const, expired: false, voided: false, alreadySigned: false };
  it("sponsor and adult athlete may sign", () => {
    expect(canSign(base)).toEqual({ ok: true, role: "counterparty" });
    expect(canSign({ ...base, who: "athlete" })).toEqual({ ok: true, role: "athlete" });
  });
  it("a minor can't sign; their guardian signs; a guardian of an adult can't", () => {
    expect(canSign({ ...base, who: "athlete", athleteIsMinor: true }).ok).toBe(false);
    expect(canSign({ ...base, who: "guardian", athleteIsMinor: true })).toEqual({ ok: true, role: "guardian" });
    expect(canSign({ ...base, who: "guardian", athleteIsMinor: false }).ok).toBe(false);
  });
  it("only while awaiting signatures, unexpired, unvoided and not already signed", () => {
    for (const status of ["offered", "guardian_review", "active", "completed", "declined", "withdrawn", "cancelled"] as const)
      expect(canSign({ ...base, status }).ok).toBe(false);
    expect(canSign({ ...base, expired: true }).ok).toBe(false);
    expect(canSign({ ...base, voided: true }).ok).toBe(false);
    expect(canSign({ ...base, alreadySigned: true }).ok).toBe(false);
  });
});

describe("name matching", () => {
  it("ignores case, spacing and accents but nothing else", () => {
    expect(nameMatches("  jordan   REYES ", "Jordan Reyes")).toBe(true);
    expect(nameMatches("José Núñez", "Jose Nunez")).toBe(true);
    expect(nameMatches("Jordan", "Jordan Reyes")).toBe(false);
    expect(nameMatches("Jordan Reyes Jr", "Jordan Reyes")).toBe(false);
    expect(nameMatches("", "")).toBe(false);
    expect(nameMatches("x", "x")).toBe(false);
    expect(normalizeName("A  B")).toBe("a b");
  });
});

describe("signature page", () => {
  it("lists signers with the document hash", () => {
    const p = renderSignaturePage("abc", [{ role: "counterparty", typedName: "Sam Sponsor", signedAt: "2026-10-06T12:00:00Z", consentVersion: "esign-v1" }]);
    expect(p).toContain("Document SHA-256: abc");
    expect(p).toContain("Sponsor: Sam Sponsor");
    expect(renderSignaturePage("abc", [])).toContain("no signatures yet");
  });
});

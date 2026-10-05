import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("allows same-site paths including queries", () => {
    expect(safeNext("/guardian/accept?token=abc")).toBe("/guardian/accept?token=abc");
  });
  it("rejects external and protocol-relative targets", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "", null, undefined, "/a\nb"])
      expect(safeNext(bad as string)).toBe("/dashboard");
  });
});

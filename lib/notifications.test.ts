import { describe, expect, it } from "vitest";
import { countLabel, isSafeHref, messageTitle } from "./notifications";

describe("notification helpers", () => {
  it("only allows dashboard-relative links", () => {
    expect(isSafeHref("/dashboard/deals/abc")).toBe(true);
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/admin", "/dashboard\\x", "/dashboard\nx", "javascript:alert(1)"])
      expect(isSafeHref(bad as string | null), String(bad)).toBe(false);
  });
  it("folds message counts into the title", () => {
    expect(messageTitle("Camp", 1)).toBe('New message on "Camp"');
    expect(messageTitle("Camp", 3)).toBe('3 new messages on "Camp"');
  });
  it("caps the badge", () => { expect(countLabel(5)).toBe("5"); expect(countLabel(250)).toBe("99+"); });
});

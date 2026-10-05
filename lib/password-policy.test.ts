import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./password-policy";

describe("validateNewPassword", () => {
  it("accepts a reasonable passphrase", () => expect(validateNewPassword("correct horse battery", "a@b.co")).toBeNull());
  it("enforces length bounds", () => {
    expect(validateNewPassword("short")).toMatch(/at least 10/);
    expect(validateNewPassword("x".repeat(201) + "y")).toMatch(/at most 200/);
    expect(validateNewPassword("abcdefghij1".repeat(19))).toMatch(/at most 200/);
  });
  it("rejects the email, repeats and common passwords", () => {
    expect(validateNewPassword("someone@example.com", "someone@example.com")).toMatch(/email/);
    expect(validateNewPassword("aaaaaaaaaaaa")).toMatch(/repetitive/);
    expect(validateNewPassword("Password1234!")).toMatch(/too common/);
  });
});

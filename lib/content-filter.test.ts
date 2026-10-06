import { describe, expect, it } from "vitest";
import { screenText } from "./content-filter";

const adult = { minorThread: false, paymentsOn: false }, minor = { minorThread: true, paymentsOn: false }, pay = { minorThread: false, paymentsOn: true };
const blocked = (t: string, o = adult) => !screenText(t, o).ok;
describe("screenText", () => {
  it("lets ordinary deal talk through", () => {
    for (const t of ["Can you do Saturday at 10?", "Great, I'll post on game day.", "The camp is at 123 Main Street, bring boots.", "Thanks! Looking forward to it", "Call 911 if hurt", "Kickoff is at 7:30 and we need 12 volunteers"])
      expect(blocked(t, minor), t).toBe(false);
  });
  it("blocks abuse and sexual solicitation everywhere, including simple obfuscation", () => {
    for (const t of ["you are a bitch", "f u c k off", "sh1t offer", "fuuuuck this", "send nudes", "check my OnlyFans", "kys", "send_nudes.png", "f.u.c.k"]) expect(blocked(t), t).toBe(true);
  });
  it("doesn't trip on innocent words that contain bad ones", () => {
    for (const t of ["Scunthorpe united", "a classic assessment", "the cocktail party", "shiitake mushrooms", "Dickens novel"]) expect(blocked(t), t).toBe(false);
  });
  it("blocks off-platform payment talk only when payments are on", () => {
    for (const t of ["just venmo me", "Pay me directly in cash", "send it by Cash App", "let's do it off platform", "I take bitcoin"]) {
      expect(blocked(t, pay), t).toBe(true);
      expect(blocked(t, adult), t + " (payments off)").toBe(false);
    }
  });
  it("blocks contact details in minors' threads", () => {
    for (const t of ["email me at coach@example.com", "coach (at) example (dot) com", "call 555-123-4567", "+1 (555) 123 4567", "my number is on the flyer",
      "follow me @coachk", "dm me on insta", "add me on snapchat", "see https://x.example/ab", "go to www.thing.co", "text me later", "find me on discord"])
      expect(blocked(t, minor), t).toBe(true);
  });
  it("allows adults to share contact details", () => {
    for (const t of ["email me at coach@example.com", "call 555-123-4567", "follow me @coachk"]) expect(blocked(t, adult), t).toBe(false);
  });
  it("explains without echoing the match", () => {
    const r = screenText("send nudes", adult);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/nudes/i);
  });
});

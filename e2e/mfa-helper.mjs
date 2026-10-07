// Test-side TOTP (an independent implementation from lib/totp.ts, so the tests also cross-check the app's maths).
import { createHmac } from "node:crypto";
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const dec = (s) => { let bits = 0, v = 0; const out = []; for (const c of s.replace(/[\s=]/g, "").toUpperCase()) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
export const totpAt = (secret, step) => { const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(step)); const h = createHmac("sha1", dec(secret)).update(ctr).digest(); const o = h[19] & 15;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0"); };
export const nowStep = () => Math.floor(Date.now() / 30000);
export const code = (secret, delta = 0) => totpAt(secret, nowStep() + delta);

/** Enrols an admin page in two-factor (their first visit to /admin sends them to /mfa/setup) and leaves that session verified. Returns the secret. */
export async function mfaEnroll(page, B, pw = "longenoughpw1") {
  await page.goto(B + "/admin"); await page.waitForLoadState("networkidle");
  if (!new URL(page.url()).pathname.startsWith("/mfa/setup")) throw new Error("expected /mfa/setup, got " + page.url());
  const secret = (await page.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "");
  await page.fill("input[name=code]", code(secret)); await page.fill("input[name=password]", pw);
  await page.click("button:text-is('Turn on two-factor')");
  await page.waitForSelector("input[type=checkbox]"); await page.check("input[type=checkbox]");
  await page.click("a:text-is('Continue')"); await page.waitForLoadState("networkidle");
  return secret;
}

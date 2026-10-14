"use server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { currentTokenHash, requireMfaPage } from "@/lib/session";
import { beginPasskeyAuthentication, finishPasskeyAuthentication } from "@/lib/passkeys";
import { limitByIp, LIMITS, waitMessage } from "@/lib/ratelimit";

/** The second step with a passkey. Same rate limit as codes; only the pending session's own user is ever offered their credentials. */
export async function beginPasskeyVerify() {
  const s = await requireMfaPage();
  const rl = await limitByIp(LIMITS.mfa);
  if (!rl.allowed) return { error: waitMessage(rl.retryAfterSeconds) };
  return beginPasskeyAuthentication(s.userId);
}

export async function finishPasskeyVerify(response: AuthenticationResponseJSON) {
  const s = await requireMfaPage();
  const rl = await limitByIp(LIMITS.mfa);
  if (!rl.allowed) return { error: waitMessage(rl.retryAfterSeconds) };
  const tok = await currentTokenHash();
  if (!tok) return { error: "Your session ended. Log in again." };
  return finishPasskeyAuthentication(s.userId, tok, response);
}

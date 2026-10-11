"use server";
import { redirect } from "next/navigation";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireUser, requireRecentMfa } from "@/lib/session";
import { isEnrolled } from "@/lib/mfa";
import { beginPasskeyRegistration, finishPasskeyRegistration, removePasskey } from "@/lib/passkeys";
import { validId } from "@/lib/operations";
import { sendNotice } from "@/lib/outbox";

/** Adding a passkey is a change to how the account is protected: it needs two-factor on, and a fresh code from the authenticator app. */
export async function beginPasskey() {
  const s = await requireUser();
  if (!(await isEnrolled(s.userId))) return { error: "Set up an authenticator app first; passkeys are added on top of it." };
  await requireRecentMfa(s, "/dashboard/settings");
  return beginPasskeyRegistration({ userId: s.userId, email: s.email, name: s.name });
}

export async function finishPasskey(name: string, response: RegistrationResponseJSON) {
  const s = await requireUser();
  if (!(await isEnrolled(s.userId))) return { error: "Set up an authenticator app first." };
  await requireRecentMfa(s, "/dashboard/settings");
  const r = await finishPasskeyRegistration(s.userId, String(name ?? ""), response);
  if ("ok" in r) await sendNotice(s.email, "A passkey was added to your LIN account", "A new passkey can now pass the two-factor check on your LIN account. If this wasn't you, remove it in Settings and change your password.");
  return r;
}

export async function removeMyPasskey(form: FormData) {
  const s = await requireUser(), id = String(form.get("passkey_id") ?? "");
  if (!validId(id)) redirect("/dashboard/settings");
  await requireRecentMfa(s, "/dashboard/settings");
  const removed = await removePasskey(s.userId, id);
  if (removed) await sendNotice(s.email, "A passkey was removed from your LIN account", "A passkey was removed from your LIN account. Your authenticator app still protects it. If this wasn't you, change your password now.");
  redirect(`/dashboard/settings?msg=${encodeURIComponent(removed ? "Passkey removed." : "That passkey was not found.")}`);
}

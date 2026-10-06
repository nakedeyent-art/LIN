"use server";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, getDeal } from "@/lib/dealsdb";
import { canPostMessage, cleanBody, MAX_MESSAGES_PER_MINUTE } from "@/lib/messaging";
import { insertMessage, notifyNewMessage } from "@/lib/messagesdb";

export async function postMessage(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/dashboard/deals");
  const back = (m: string): never => redirect(`/dashboard/deals/${id}/messages?error=${encodeURIComponent(m)}`);

  const d = await getDeal(s.userId, id);          // same visibility rule as the deal itself
  if (!d) redirect("/dashboard/deals");
  const who = await capacityOn(s.userId, d);
  const ctx = await dealContext(d);
  const can = canPostMessage({ who, athleteIsMinor: ctx.athleteIsMinor, athleteHasGuardian: ctx.athleteHasGuardian, status: d.status, expired: ctx.expired });
  if (!can.ok) back(can.error);
  const c = cleanBody(String(formData.get("body") ?? ""));
  if (!c.ok) back(c.error);

  const r = await insertMessage(id, s.userId, (c as { body: string }).body, MAX_MESSAGES_PER_MINUTE);
  if (!r.ok) back("You're sending messages too quickly. Wait a moment and try again.");
  else await notifyNewMessage(id, r);
  redirect(`/dashboard/deals/${id}/messages#end`);
}

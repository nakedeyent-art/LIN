"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, getDeal } from "@/lib/dealsdb";
import { canPostMessage, cleanBody, MAX_MESSAGES_PER_MINUTE, type PostState } from "@/lib/messaging";
import { screenText } from "@/lib/content-filter";
import { checkUploads } from "@/lib/attachments";
import { paymentsEnabled } from "@/lib/stripe";
import { insertMessage, notifyNewMessage } from "@/lib/messagesdb";
import { addBlock, liftBlock, pairBlocked } from "@/lib/blocksdb";
import { isReason, MAX_NOTE, MAX_REPORTS_PER_DAY } from "@/lib/reports";

const UUID = /^[0-9a-f-]{36}$/i;

/** Used with useActionState: errors come back as state (so the draft stays in the box), success bumps `sent`. */
export async function postMessage(_prev: PostState, formData: FormData): Promise<PostState> {
  const draft = String(formData.get("body") ?? "").slice(0, 2000);
  const fail = (error: string): PostState => ({ error, draft });   // React clears the form after an action, so hand the text back
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/deals");

  const d = await getDeal(s.userId, id);          // same visibility rule as the deal itself
  if (!d) redirect("/dashboard/deals");
  const who = await capacityOn(s.userId, d);
  const ctx = await dealContext(d);
  const can = canPostMessage({ who, athleteIsMinor: ctx.athleteIsMinor, athleteHasGuardian: ctx.athleteHasGuardian, status: d.status, expired: ctx.expired,
    blocked: await pairBlocked(d.athlete_id, d.counterparty_id) });
  if (!can.ok) return fail(can.error);
  const c = cleanBody(String(formData.get("body") ?? ""));
  if (!c.ok) return fail(c.error);
  const body = c.body;
  const screen = { minorThread: ctx.athleteIsMinor, paymentsOn: paymentsEnabled() };

  const raw = formData.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  const named = await Promise.all(raw.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
  for (const t of [body, ...named.map((f) => f.name)]) { const r = screenText(t, screen); if (!r.ok) return fail(r.error); }
  const have = (await db().query("SELECT count(*)::int AS n FROM deal_attachments WHERE deal_id=$1", [id])).rows[0].n as number;
  const up = checkUploads(named, have);
  if (!up.ok) return fail(up.error);

  const r = await insertMessage(id, s.userId, body, MAX_MESSAGES_PER_MINUTE, up.files);
  if (!r.ok) return fail("limited" in r ? "You're sending messages too quickly. Wait a moment and try again." : r.error);
  await notifyNewMessage(id, r);
  return { sent: Date.now() };
}

export async function reportMessage(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const dealId = String(formData.get("deal_id") ?? ""), messageId = Number(formData.get("message_id"));
  const back = (k: "msg" | "error", m: string): never => redirect(`/dashboard/deals/${dealId}/messages?${k}=${encodeURIComponent(m)}`);
  if (!UUID.test(dealId) || !Number.isSafeInteger(messageId)) redirect("/dashboard/deals");
  const d = await getDeal(s.userId, dealId);
  if (!d) redirect("/dashboard/deals");
  if (!(await capacityOn(s.userId, d))) redirect("/dashboard/deals");
  const reason = String(formData.get("reason") ?? "");
  if (!isReason(reason)) back("error", "Choose what's wrong with the message.");
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_NOTE);

  const m = (await db().query("SELECT sender_id, hidden_at, body FROM deal_messages WHERE id=$1 AND deal_id=$2", [messageId, dealId])).rows[0];
  if (!m) back("error", "That message doesn't exist.");
  if (m.sender_id === s.userId) back("error", "You can't report your own message.");
  const today = (await db().query("SELECT count(*)::int AS n FROM message_reports WHERE reporter_id=$1 AND created_at > NOW() - INTERVAL '1 day'", [s.userId])).rows[0].n;
  if (today >= MAX_REPORTS_PER_DAY) back("error", "You've sent a lot of reports today. Please try again tomorrow.");
  const ins = await db().query(
    "INSERT INTO message_reports(message_id, deal_id, reporter_id, reason, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (message_id, reporter_id) DO NOTHING RETURNING id",
    [messageId, dealId, s.userId, reason, note || null]);
  back("msg", ins.rowCount ? "Thanks — a moderator will review this message. You can also block this person." : "You've already reported that message.");
}

export async function blockCounterpart(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const dealId = String(formData.get("deal_id") ?? "");
  if (!UUID.test(dealId)) redirect("/dashboard/deals");
  const d = await getDeal(s.userId, dealId);
  if (!d) redirect("/dashboard/deals");
  const who = await capacityOn(s.userId, d);
  if (!who || (who === "guardian" && !d.athlete_minor)) redirect("/dashboard/deals");
  await addBlock(d, s.userId, who);
  redirect(`/dashboard/deals/${dealId}/messages?msg=${encodeURIComponent("Blocked. Messaging is off between you on every deal, and new offers between you are stopped. Existing deals carry on.")}`);
}

export async function unblockCounterpart(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const dealId = String(formData.get("deal_id") ?? "");
  if (!UUID.test(dealId)) redirect("/dashboard/deals");
  const d = await getDeal(s.userId, dealId);
  if (!d) redirect("/dashboard/deals");
  const who = await capacityOn(s.userId, d);
  if (!who) redirect("/dashboard/deals");
  const lifted = await liftBlock(d, s.userId, who);
  redirect(`/dashboard/deals/${dealId}/messages?${lifted ? "msg" : "error"}=${encodeURIComponent(lifted ? "Unblocked." : "You can't lift this block. If the athlete is under 18, a parent/guardian does that.")}`);
}

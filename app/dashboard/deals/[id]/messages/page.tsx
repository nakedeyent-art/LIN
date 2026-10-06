import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, getDeal } from "@/lib/dealsdb";
import { StatusBadge } from "@/components/deal-ui";
import { Card, Disclaimer } from "@/components/ui";
import { canPostMessage, THREAD_PAGE } from "@/lib/messaging";
import { listThread, markRead } from "@/lib/messagesdb";
import { blockState } from "@/lib/blocksdb";
import { toView } from "@/lib/threadview";
import { Thread } from "@/components/thread";
import { blockCounterpart, postMessage, reportMessage, unblockCounterpart } from "../../message-actions";

export const metadata: Metadata = { title: "Deal messages" };

export default async function DealMessages({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; msg?: string }> }) {
  const s = await requireAccess("/dashboard/deals");
  const { id } = await params;
  const { error, msg } = await searchParams;
  const d = await getDeal(s.userId, id);
  if (!d) notFound();
  const who = await capacityOn(s.userId, d);
  if (!who) notFound();
  const ctx = await dealContext(d);
  const block = await blockState(d, s.userId, who);
  const can = canPostMessage({ who, athleteIsMinor: ctx.athleteIsMinor, athleteHasGuardian: ctx.athleteHasGuardian, status: d.status, expired: ctx.expired, blocked: block.blocked });
  const { messages, total } = await listThread(d.id, s.userId);
  await markRead(d.id, s.userId);
  const view = messages.map((m) => toView(m, s.userId, who, d));
  const otherName = who === "counterparty" ? "this athlete" : d.counterparty_name;

  return (
    <>
      <h1>Messages — {d.title} <StatusBadge d={d} /></h1>
      <div className="tag"><Link href={`/dashboard/deals/${d.id}`}>← Back to the deal</Link> · <Link href="/dashboard/deals/search">Search messages</Link></div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <Card title="Conversation" wide>
        <p className="muted">
          {ctx.athleteIsMinor
            ? "This athlete is under 18, so every message here is also visible to their linked parent/guardian. Contact details, links and social handles can't be shared."
            : "Visible to the sponsor and the athlete."}{" "}
          Messages can&apos;t be edited or deleted, and aren&apos;t part of the signed agreement. Be respectful: abusive messages are blocked and anyone can report a message to a moderator.
        </p>
        {total > view.length && <p className="muted">Showing the latest {THREAD_PAGE} of {total} messages.</p>}
        <Thread dealId={d.id} initial={view} canPost={can.ok} closedNote={can.ok ? null : can.error} post={postMessage} report={reportMessage} />
        <p className="muted">Don&apos;t share passwords, card or bank details here. Everyone on this deal gets an email that a message is waiting — never its text. Attachments are download-only and aren&apos;t scanned for viruses: open them with care.</p>
      </Card>
      {(who !== "guardian" || d.athlete_minor) && (
        <Card title="Safety" wide>
          {block.byMe ? (
            <>
              <p>You&apos;ve blocked {otherName}: messaging is off between you on every deal, and new offers between you are stopped. Existing deals carry on.</p>
              {block.canLift
                ? <form action={unblockCounterpart}><input type="hidden" name="deal_id" value={d.id} /><button className="btn ghost" type="submit">Unblock</button></form>
                : <p className="muted">A parent/guardian lifts blocks that protect an athlete under 18.</p>}
            </>
          ) : block.blocked && block.canLift ? (
            <form action={unblockCounterpart}><p>A block protecting this athlete is in place.</p><input type="hidden" name="deal_id" value={d.id} /><button className="btn ghost" type="submit">Lift the block</button></form>
          ) : block.blocked ? <p className="muted">Messaging isn&apos;t available on this deal right now.</p> : (
            <form action={blockCounterpart}>
              <input type="hidden" name="deal_id" value={d.id} />
              <p>Not comfortable? You can block {otherName}. Messaging stops on every deal you share and they can&apos;t send new offers; deals already underway continue.</p>
              <button className="btn ghost" type="submit">Block {otherName}</button>
            </form>)}
        </Card>)}
      <Disclaimer>Keep conversations respectful and about this deal. Compensation must be for real NIL deliverables only.</Disclaimer>
    </>
  );
}

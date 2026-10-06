import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, getDeal } from "@/lib/dealsdb";
import { athleteLabel, StatusBadge } from "@/components/deal-ui";
import { Card, Disclaimer } from "@/components/ui";
import { CAPACITY_LABEL, canPostMessage, MAX_MESSAGE_CHARS, THREAD_PAGE } from "@/lib/messaging";
import { listThread, markRead } from "@/lib/messagesdb";
import { postMessage } from "../../message-actions";

export const metadata: Metadata = { title: "Deal messages" };
const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function DealMessages({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const s = await requireAccess("/dashboard/deals");
  const { id } = await params;
  const { error } = await searchParams;
  const d = await getDeal(s.userId, id);
  if (!d) notFound();
  const who = await capacityOn(s.userId, d);
  if (!who) notFound();
  const ctx = await dealContext(d);
  const can = canPostMessage({ who, athleteIsMinor: ctx.athleteIsMinor, athleteHasGuardian: ctx.athleteHasGuardian, status: d.status, expired: ctx.expired });
  const { messages, total } = await listThread(d.id);
  await markRead(d.id, s.userId);

  // Same name rules as the rest of the deal: third parties see a minor as "First L.".
  const nameOf = (m: { sender_id: string; sender_name: string }) => {
    const role = m.sender_id === d.counterparty_id ? "Sponsor" : m.sender_id === d.athlete_id ? "Athlete" : "Parent/guardian";
    const name = m.sender_id === d.athlete_id ? athleteLabel(d, s.userId, who === "guardian") : m.sender_id === s.userId ? "You" : m.sender_name;
    return { role, name };
  };

  return (
    <>
      <h1>Messages — {d.title} <StatusBadge d={d} /></h1>
      <div className="tag"><Link href={`/dashboard/deals/${d.id}`}>← Back to the deal</Link></div>
      {error && <p role="alert" className="error">{error}</p>}
      <Card title="Conversation" wide>
        <p className="muted">
          {ctx.athleteIsMinor
            ? "This athlete is under 18, so every message here is also visible to their linked parent/guardian."
            : "Visible to the sponsor and the athlete."}{" "}
          Messages can&apos;t be edited or deleted. They are not part of the signed agreement — put any change to the terms in a new deal.
        </p>
        {total > messages.length && <p className="muted">Showing the latest {THREAD_PAGE} of {total} messages.</p>}
        {messages.length === 0 ? <p className="muted">No messages yet.</p> : (
          <ol className="thread" style={{ listStyle: "none", padding: 0 }}>
            {messages.map((m) => {
              const n = nameOf(m);
              return (
                <li key={m.id} style={{ marginBottom: 12 }}>
                  <div><strong>{n.name}</strong> <span className="muted">· {n.role} · {fmt(m.created_at)}</span></div>
                  <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
                </li>);
            })}
          </ol>)}
        <div id="end" />
      </Card>
      <Card title="Write a message" wide>
        {can.ok ? (
          <form action={postMessage}>
            <input type="hidden" name="deal_id" value={d.id} />
            <label>Message ({CAPACITY_LABEL[who]})
              <textarea name="body" rows={4} maxLength={MAX_MESSAGE_CHARS} required style={{ width: "100%" }} /></label>
            <button className="btn" type="submit">Send</button>
          </form>
        ) : <p className="muted">{can.error}</p>}
        <p className="muted">Don&apos;t share passwords, card or bank details here. Everyone on this deal gets an email that a message is waiting — never its text.</p>
      </Card>
      <Disclaimer>Keep conversations respectful and about this deal. Compensation must be for real NIL deliverables only.</Disclaimer>
    </>
  );
}

import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listNotifications } from "@/lib/notificationsdb";
import { KIND_LABEL, NOTIFICATION_RETENTION_DAYS } from "@/lib/notifications";
import { Badge, Card } from "@/components/ui";
import { markAllNotificationsRead, openNotification } from "./actions";

export const metadata: Metadata = { title: "Notifications" };
const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function Notifications() {
  const s = await requireUser();
  const items = await listNotifications(s.userId);
  const unread = items.filter((i) => !i.read_at).length;
  return (
    <>
      <h1>Notifications</h1>
      <div className="tag">What changed on your deals, payments, messages and family links.</div>
      <Card title={unread ? `${unread} unread` : "All caught up"} wide>
        {unread > 0 && <form action={markAllNotificationsRead}><button className="btn ghost" type="submit">Mark all as read</button></form>}
        {items.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((n) => (
              <li key={n.id} style={{ marginBottom: 10, opacity: n.read_at ? 0.65 : 1 }}>
                <form action={openNotification} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className="btn ghost" style={{ textAlign: "left", whiteSpace: "normal" }}>
                    {!n.read_at && <Badge tone="yellow">new</Badge>} {n.title}{n.count > 1 ? ` (${n.count} in total)` : ""}
                  </button>
                </form>
                <div className="muted">{KIND_LABEL[n.kind]} · {fmt(n.created_at)}</div>
              </li>))}
          </ul>)}
        <p className="muted">Showing your latest 50. Read notifications are removed after {NOTIFICATION_RETENTION_DAYS} days. Notifications never include amounts or message text.</p>
      </Card>
    </>
  );
}

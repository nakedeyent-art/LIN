import Link from "next/link";
import { Badge } from "./ui";
import { displayName, formatCents, STATUS_LABEL, type DealStatus } from "@/lib/deals";
import type { DealRow } from "@/lib/dealsdb";

export const statusTone = (s: DealStatus, expired: boolean): "green" | "yellow" | "red" | "gray" =>
  expired ? "gray" : s === "active" || s === "completed" ? "green" : s === "offered" || s === "guardian_review" ? "yellow" : "red";

export const isExpired = (d: Pick<DealRow, "status" | "expires_at">) =>
  (d.status === "offered" || d.status === "guardian_review") && !!d.expires_at && new Date(d.expires_at) < new Date();

/** Name of the athlete as the viewer is allowed to see it (minors are abbreviated for non-family). */
export const athleteLabel = (d: DealRow, viewerId: string, linkedGuardian: boolean) =>
  d.athlete_id === viewerId || linkedGuardian ? d.athlete_name : displayName(d.athlete_name, d.athlete_minor);

export function StatusBadge({ d }: { d: DealRow }) {
  const ex = isExpired(d);
  return <Badge tone={statusTone(d.status, ex)}>{ex ? "Expired" : STATUS_LABEL[d.status]}</Badge>;
}

export function DealTable({ deals, viewerId, role }: { deals: DealRow[]; viewerId: string; role: string }) {
  if (!deals.length) return <p className="muted">No deals yet.</p>;
  return (
    <table>
      <thead><tr><th>Deal</th><th>{role === "athlete" || role === "parent" ? "From" : "Athlete"}</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>{deals.map((d) => (
        <tr key={d.id}>
          <td><Link href={`/dashboard/deals/${d.id}`} style={{ textDecoration: "underline" }}>{d.title}</Link></td>
          <td>{role === "athlete" || role === "parent" ? d.counterparty_name : athleteLabel(d, viewerId, false)}</td>
          <td>{formatCents(d.amount_cents)}</td>
          <td><StatusBadge d={d} /></td>
        </tr>))}
      </tbody>
    </table>
  );
}

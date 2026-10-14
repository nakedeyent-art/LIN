import Link from "next/link";
import { requireUser } from "@/lib/session";
import { subjectsFor } from "@/lib/access";

export default async function Operations() {
  const s = await requireUser();
  const athletes = await subjectsFor(s);
  return <><p className="eyebrow">Athlete operations</p><h1>Your athletes</h1><p className="tag">Schedule, documents, development and deal activity in one record.</p>
    <section className="work-panel"><table><thead><tr><th>Athlete</th><th>Sport</th><th>Level</th><th>Relationship</th></tr></thead><tbody>
      {athletes.map(a => <tr key={a.id}><td><Link className="record-link" href={`/dashboard/operations/${a.id}`}>{a.name}</Link></td><td>{a.sport}</td><td>{a.level.replaceAll("_", " ")}</td><td>{a.relationship === "self" ? "You" : a.relationship.replaceAll("_", " ")}</td></tr>)}
    </tbody></table>{!athletes.length && <p className="empty-state">No athlete records are shared with you yet. Athletes and guardians manage invitations from Team.</p>}</section>
  </>;
}

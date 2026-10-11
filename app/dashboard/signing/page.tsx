import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getEnvelope } from "@/lib/signing";
export default async function Signing() {
 const s=await requireUser();
 const rows=(await db().query(`SELECT e.id FROM signing_envelopes e WHERE e.athlete_id=$1 OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=e.athlete_id AND g.member_id=$1) OR EXISTS(SELECT 1 FROM signing_recipients r WHERE r.envelope_id=e.id AND r.user_id=$1) ORDER BY e.created_at DESC LIMIT 100`,[s.userId])).rows;
 const envelopes=(await Promise.all(rows.map(r=>getEnvelope(s,r.id)))).filter(e=>e!==null);
 return <><p className="eyebrow">Forg3</p><h1>Agreements and signatures</h1><p className="tag">Prepare a PDF in the document center, select recipients and define their fields.</p><p><Link className="record-link" href="/dashboard/documents">Open document center →</Link></p><section className="work-panel"><table><thead><tr><th>Agreement</th><th>Status</th><th>Expires</th></tr></thead><tbody>{envelopes.map(e=><tr key={e.id}><td><Link className="record-link" href={`/dashboard/signing/${e.id}`}>{e.title}</Link></td><td>{new Date(e.expires_at)<new Date()&&['draft','sent','viewed','partially_signed'].includes(e.status)?'expired':e.status.replaceAll('_',' ')}</td><td>{new Date(e.expires_at).toISOString().slice(0,10)}</td></tr>)}</tbody></table>{!envelopes.length&&<p className="empty-state">No agreements available to your account.</p>}</section></>;
}

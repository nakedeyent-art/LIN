import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { displayName, OFFER_ROLES } from "@/lib/deals";
import { Disclaimer } from "@/components/ui";
import { createOffer } from "../actions";

export default async function NewOffer({ searchParams }: { searchParams: Promise<{ athlete?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/athletes");
  if (!OFFER_ROLES.includes(s.role)) notFound();
  const { athlete, error } = await searchParams;
  if (!athlete || !/^[0-9a-f-]{36}$/i.test(athlete)) notFound();
  const a = (await db().query(
    `SELECT u.full_name, ap.sport, ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
       FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id WHERE ap.user_id=$1 AND ap.discoverable`, [athlete])).rows[0];
  if (!a) notFound();
  return (
    <form action={createOffer} style={{ maxWidth: 560 }}>
      <h1>Make an offer</h1>
      <div className="tag">To {displayName(a.full_name, a.minor)} · {a.sport}{a.minor ? " · under 18: a parent/guardian must approve" : ""}</div>
      {error && <p role="alert" className="error">{error}</p>}
      <input type="hidden" name="athlete_id" value={athlete} />
      <p><input type="text" name="title" placeholder="Title (e.g. Social media ambassador)" maxLength={100} required /></p>
      <p><input type="text" name="amount" placeholder="Amount in USD (e.g. 1500)" inputMode="decimal" required /></p>
      <p><textarea name="deliverables" placeholder="What will the athlete do in return? Be specific: posts, appearances, dates." rows={6} maxLength={2000} required
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" }} /></p>
      <label style={{ display: "block", marginBottom: 12 }}><input type="checkbox" name="attest" /> I confirm this compensation is for NIL deliverables at fair market value — not for enrollment, recruitment, or athletic performance.</label>
      <button className="btn" type="submit">Send offer</button>
      <Disclaimer>The offer expires in 14 days. The athlete (and, if under 18, a linked guardian) must accept before it becomes active.</Disclaimer>
    </form>
  );
}

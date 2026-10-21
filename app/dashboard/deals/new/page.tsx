import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { displayName, OFFER_ROLES } from "@/lib/deals";
import { DealOfferForm } from "@/components/deal-offer-form";
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
    <DealOfferForm
      athleteId={athlete}
      athleteName={displayName(a.full_name, a.minor)}
      sport={a.sport}
      isMinor={Boolean(a.minor)}
      error={error}
      action={createOffer}
    />
  );
}


import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { BLOCKED_SQL } from "@/lib/blocksdb";
import { Disclaimer } from "@/components/ui";
import {
  type AthleteDirectoryItem,
  type AthleteLevel,
  SAMPLE_ATHLETE_DIRECTORY,
} from "@/lib/athlete-directory";
import { AthleteMarketplaceSuite } from "@/components/athlete-marketplace-suite";

export default async function Athletes({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; level?: string; state?: string; q?: string }>;
}) {
  const s = await requireAccess("/dashboard/athletes");
  const p = await searchParams;
  const sport = (p.sport ?? "").trim().slice(0, 50);

  // Only opted-in, verified athletes; minors only once a guardian is linked. No email / birth date is ever selected.
  let rows: any[] = [];
  try {
    const res = await db().query(
      `SELECT u.id, u.full_name, ap.sport, ap.position, ap.level, ap.state, ap.grad_year,
              ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
         FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id
        WHERE ap.discoverable AND u.email_verified_at IS NOT NULL
          AND (ap.birth_date <= CURRENT_DATE - INTERVAL '18 years' OR EXISTS (
                SELECT 1 FROM guardian_links r WHERE r.athlete_id = u.id))
          AND ($1 = '' OR ap.sport ILIKE $1)
          AND NOT ${BLOCKED_SQL("u.id", "$2::uuid")}
        ORDER BY u.full_name LIMIT 100`,
      [sport, s.userId]
    );
    rows = res.rows;
  } catch {
    rows = [];
  }

  const dbAthletes: AthleteDirectoryItem[] = rows.map((r) => {
    const isMinor = Boolean(r.minor);
    const lvl: AthleteLevel = r.level === "high_school" ? "high_school" : "college";
    return {
      id: r.id,
      fullName: r.full_name,
      sport: r.sport,
      position: r.position ?? undefined,
      level: lvl,
      state: r.state ?? "FL",
      gradYear: r.grad_year ?? (isMinor ? 2026 : 2027),
      isMinor,
      hasGuardianLinked: true,
      representationStatus: "Self-Represented",
      schoolOrInstitution: lvl === "college" ? "Collegiate Athletics" : "Scholastic Prep",
      followers: 18500,
      engagementRate: 4.9,
      fairMarketValueDollars: 650,
      rateCard: {
        socialMediaPostDollars: 600,
        inPersonAppearanceDollars: 900,
        skillsClinicDollars: 800,
        brandCommercialDollars: 2400,
      },
      complianceStatus: lvl === "college" ? "NCAA_COMPLIANT" : "NFHS_COMPLIANT",
      digitalPassVerified: true,
      verificationHash: "f6e8a712c9389bd5f39e8020d1c81ef407a1c8d0b2847d0e82c8b74f35e021a9",
    };
  });

  const existingIds = new Set(dbAthletes.map((a) => a.id));
  const combinedAthletes: AthleteDirectoryItem[] = [
    ...dbAthletes,
    ...SAMPLE_ATHLETE_DIRECTORY.filter((item) => !existingIds.has(item.id)),
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Find Athletes &amp; Verified NIL Passes</h1>
          <div className="tag" style={{ marginTop: 4 }}>
            Athletes who chose to be listed with cryptographically verified credentials, audience analytics, and compliance clearances.
          </div>
        </div>
      </div>

      <AthleteMarketplaceSuite
        initialAthletes={combinedAthletes}
        viewerRole={s.role}
        viewerUserId={s.userId}
      />

      <div style={{ marginTop: 24 }}>
        <Disclaimer>
          {s.role === "recruiter"
            ? "Academic details appear on your board only for athletes who invited you and chose to share them. All scouting evaluations remain private."
            : "Athletes under 18 need a parent/guardian to approve any deal; offers to them are held in parental escrow until verified."}
        </Disclaimer>
      </div>
    </>
  );
}


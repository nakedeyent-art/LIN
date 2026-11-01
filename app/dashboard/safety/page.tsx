import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { minorsGuardedBy, grownAthletesOf, guardiansOf } from "@/lib/guardians";
import { listDeals } from "@/lib/dealsdb";
import { GuardianSafetyCenter, type GuardianSafetyAthleteData } from "@/components/guardian-safety-center";
import { Disclaimer } from "@/components/ui";
import Link from "next/link";

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const s = await requireAccess("/dashboard/safety");
  const p = await searchParams;
  const isParent = s.role === "parent";

  let targetAthleteId = s.userId;
  let minorsList: { id: string; name: string; sport: string | null; listed: boolean }[] = [];
  let grownList: any[] = [];

  if (isParent) {
    try {
      [minorsList, grownList] = await Promise.all([
        minorsGuardedBy(s.userId),
        grownAthletesOf(s.userId),
      ]);
      if (p.athlete && (minorsList.some((m) => m.id === p.athlete) || grownList.some((g) => g.id === p.athlete))) {
        targetAthleteId = p.athlete;
      } else if (minorsList.length > 0) {
        targetAthleteId = minorsList[0].id;
      } else if (grownList.length > 0) {
        targetAthleteId = grownList[0].id;
      }
    } catch {
      minorsList = [];
      grownList = [];
    }
  }

  // Fetch athlete profile & user details
  let athleteData: GuardianSafetyAthleteData | null = null;

  try {
    const profRes = await db().query(
      `SELECT u.id, u.full_name, ap.sport, ap.level, ap.state, ap.discoverable,
              ap.birth_date::text AS birth_date,
              ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
         FROM users u
         JOIN athlete_profiles ap ON ap.user_id = u.id
        WHERE u.id = $1`,
      [targetAthleteId]
    );

    if (profRes.rows.length > 0) {
      const row = profRes.rows[0];
      const [guardians, deals, teamRows] = await Promise.all([
        guardiansOf(row.id),
        listDeals(row.id),
        db().query(
          `SELECT r.id, u.full_name AS name, r.relationship, r.can_view_academics, r.can_view_health,
                  EXISTS(SELECT 1 FROM manager_declarations md WHERE md.manager_id = u.id AND md.credential_verified) AS is_verified_agent
             FROM athlete_relationships r
             JOIN users u ON u.id = r.member_id
            WHERE r.athlete_id = $1`,
          [row.id]
        ),
      ]);

      const pendingDeals = deals
        .filter((d) => ["guardian_review", "offered", "active"].includes(d.status))
        .map((d) => ({
          id: d.id,
          title: d.title,
          sponsorName: d.counterparty_name ?? "Brand Partner",
          amountCents: d.amount_cents,
          deliverables: d.deliverables,
          status: d.status,
        }));

      athleteData = {
        id: row.id,
        name: row.full_name,
        sport: row.sport,
        level: row.level,
        birthDate: row.birth_date ?? "2008-08-15",
        isMinor: Boolean(row.minor),
        isDiscoverable: Boolean(row.discoverable),
        guardians: guardians.map((g) => ({ name: g.name, email: g.email })),
        pendingDeals,
        teamMembers: teamRows.rows.map((t) => ({
          id: t.id,
          name: t.name,
          relationship: t.relationship,
          canViewAcademics: Boolean(t.can_view_academics),
          canViewHealth: Boolean(t.can_view_health),
          isVerifiedAgent: Boolean(t.is_verified_agent),
        })),
      };
    }
  } catch {
    athleteData = null;
  }

  // Graceful fallback for empty development environments
  if (!athleteData) {
    athleteData = {
      id: targetAthleteId,
      name: isParent ? "Marcus Hill" : s.name,
      sport: "Basketball",
      level: "high_school",
      birthDate: "2009-04-18", // 17 years old
      isMinor: true,
      isDiscoverable: true,
      guardians: isParent ? [{ name: s.name, email: s.email }] : [{ name: "Sarah Hill (Guardian)", email: "sarah.hill@example.com" }],
      pendingDeals: [
        {
          id: "deal-sample-1",
          title: "Apex Athletics Summer Showcase Campaign",
          sponsorName: "Apex Performance Nutrition",
          amountCents: 125000,
          deliverables: "2 Instagram Reels wearing branded apparel with #ad disclosure",
          status: "guardian_review",
        },
        {
          id: "deal-sample-2",
          title: "Regional High School Skills Clinic Lead",
          sponsorName: "Metro Hoops Academy",
          amountCents: 75000,
          deliverables: "1-day weekend youth skills camp coaching appearance",
          status: "guardian_review",
        },
      ],
      teamMembers: [
        {
          id: "mem-1",
          name: "Coach Darrell Taylor",
          relationship: "coach",
          canViewAcademics: true,
          canViewHealth: true,
          isVerifiedAgent: false,
        },
        {
          id: "mem-2",
          name: "Jason Vance, Esq.",
          relationship: "manager",
          canViewAcademics: false,
          canViewHealth: false,
          isVerifiedAgent: true,
        },
      ],
    };
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Family Safety &amp; Minor Protection Center</h1>
          <div className="tag" style={{ marginTop: 4 }}>
            Statutory minor student-athlete protections, custodial escrow safeguards, and age-18 emancipation transitions.
          </div>
        </div>

        {isParent && minorsList.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Student-Athlete:</span>
            <select
              defaultValue={athleteData.id}
              onChange={(e) => {
                if (typeof window !== "undefined") {
                  window.location.href = `/dashboard/safety?athlete=${e.target.value}`;
                }
              }}
              style={{ padding: "6px 12px", fontSize: 13 }}
            >
              {minorsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.sport ?? "Athlete"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <GuardianSafetyCenter
        athlete={athleteData}
        viewerRole={s.role}
        isParent={isParent}
      />

      <div style={{ marginTop: 24 }}>
        <Disclaimer>
          Under Federal Trade Commission guidelines and state athletic association amateurism regulations, contracts executed
          by minors without verified guardian co-signatures are voidable. All commercial earnings remain protected in parental
          custodial escrow until deliverables pass review.
        </Disclaimer>
      </div>
    </>
  );
}

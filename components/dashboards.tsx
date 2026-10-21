import { BLOCKED_SQL } from "@/lib/blocksdb";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@/lib/session";
import { db } from "@/lib/db";
import { subjectsFor } from "@/lib/access";
import { snapshots, type Snapshot } from "@/lib/snapshot";
import { listDeals } from "@/lib/dealsdb";
import { grownAthletesOf } from "@/lib/guardians";
import { displayName, formatCents, isOpen } from "@/lib/deals";
import { todayStr } from "@/lib/academics";
import { Badge, Card, Grid, List, Stat } from "./ui";
import { setStage, untrack } from "@/app/dashboard/athletes/actions";

const Empty = ({ children }: { children: ReactNode }) => <p className="muted">{children}</p>;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} style={{ textDecoration: "underline" }}>
    {children}
  </Link>
);

function ActionToolbar({
  actions,
}: {
  actions: { label: string; href: string; icon?: string; primary?: boolean; needs?: boolean }[];
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={`btn ${a.needs ? "needs" : a.primary ? "" : "ghost"} small`}
          style={{ textDecoration: "none" }}
        >
          {a.icon && <span style={{ marginRight: 4 }}>{a.icon}</span>}
          {a.label}
        </Link>
      ))}
    </div>
  );
}

function alertBadges(s: Snapshot) {
  const al = s.academics?.alerts ?? [];
  const red = al.filter((a) => a.level === "red").length;
  const yellow = al.length - red;
  return (
    <>
      {red > 0 && <Badge tone="red">{red} red</Badge>}{" "}
      {yellow > 0 && <Badge tone="yellow">{yellow} yellow</Badge>}
      {al.length === 0 && s.academics && (
        s.academics.courses ? <Badge tone="green">clear</Badge> : <span className="muted">no grades</span>
      )}
    </>
  );
}

/** Roster table used by coach / trainer / manager / parent — shows permitted columns */
function Roster({ rows, link }: { rows: Snapshot[]; link?: (s: Snapshot) => string }) {
  const hasA = rows.some((r) => r.academics);
  const hasH = rows.some((r) => r.health);
  return (
    <table>
      <thead>
        <tr>
          <th>Athlete</th>
          {hasA && (
            <>
              <th>Academic alerts</th>
              <th>Competition gate</th>
            </>
          )}
          {hasH && (
            <>
              <th>Training (14d)</th>
              <th>Nutrition (14d)</th>
              <th>Next workout</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{link ? <A href={link(r)}>{r.name}</A> : r.name}</td>
            {hasA && (
              <>
                <td>{r.academics ? alertBadges(r) : "—"}</td>
                <td>
                  {r.academics ? (
                    <Badge tone={r.academics.gate ? "green" : "red"}>
                      {r.academics.gate ? "Cleared" : "Not cleared"}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
              </>
            )}
            {hasH && (
              <>
                <td>
                  {r.health ? (
                    <>
                      {pct(r.health.adherence)}
                      {r.health.missedWeek && <> <Badge tone="yellow">2+ missed</Badge></>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.health ? (
                    r.health.hasPlan ? pct(r.health.compliance) : <span className="muted">no plan</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {r.health ? (
                    r.health.next ? `${r.health.next.day} · ${r.health.next.title}` : <span className="muted">none</span>
                  ) : (
                    "—"
                  )}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ==========================================================================
   1. Athlete Dashboard
   ========================================================================== */
async function Athlete({ s }: { s: Session }) {
  const today = todayStr();
  const [me] = await subjectsFor(s);
  const [snap] = me ? await snapshots([me], today) : [];
  const prof = (await db().query(
    `SELECT height_cm IS NOT NULL AS has_metrics, discoverable, birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor,
            (SELECT count(*)::int FROM nutrition_plans n WHERE n.athlete_id = ap.user_id AND n.active_until IS NULL) AS plans,
            (SELECT count(*)::int FROM guardian_links r WHERE r.athlete_id = ap.user_id) AS guardians,
            (SELECT count(*)::int FROM athlete_relationships r WHERE r.athlete_id = ap.user_id AND r.relationship <> 'parent') AS team,
            (SELECT count(*)::int FROM academic_logs l WHERE l.athlete_id = ap.user_id) AS grades
       FROM athlete_profiles ap WHERE ap.user_id=$1`,
    [s.userId]
  )).rows[0];

  const deals = await listDeals(s.userId);
  const activeDeals = deals.filter((d) => d.status === "active").length;
  const completedEarnings = deals
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + d.amount_cents, 0);

  const steps: [boolean, string, string][] = [
    [!!prof?.has_metrics, "Add body details for nutrition targets", "/dashboard/nutrition"],
    [(prof?.plans ?? 0) > 0, "Pick a performance profile", "/dashboard/nutrition"],
    [(prof?.grades ?? 0) > 0, "Enter your current grades", "/dashboard/academics"],
    [(prof?.team ?? 0) > 0, "Invite a coach or trainer", "/dashboard/team"],
    [!!prof?.discoverable, "List yourself to sponsors", "/dashboard/deals"],
    ...(prof?.minor
      ? [[(prof?.guardians ?? 0) > 0, "Get a parent/guardian linked", "/dashboard"] as [boolean, string, string]]
      : []),
  ];

  const completedSteps = steps.filter(([ok]) => ok).length;

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Log Workout", href: "/dashboard/training", icon: "🏋️", primary: true },
          { label: "Nutrition Plan", href: "/dashboard/nutrition", icon: "🥗" },
          { label: "Study Hall Focus", href: "/dashboard/academics", icon: "⏱️" },
          { label: "Find Deals", href: "/dashboard/deals", icon: "💼" },
          { label: "Brand Profile", href: "/dashboard/settings", icon: "⚙️" },
        ]}
      />
      <Grid>
        <Card title="Today & Performance">
          <Stat
            label="Next workout"
            value={snap?.health?.next ? snap.health.next.title : "None"}
            hint={snap?.health?.next?.day ?? "Ask a trainer to assign one"}
          />
          <Stat
            label="Verified study (7d)"
            value={`${snap?.academics?.verifiedMinutes ?? 0}m`}
            hint={snap?.academics?.gate ? "Gate: cleared" : "Gate: at risk"}
          />
          <Stat label="Training adherence" value={pct(snap?.health?.adherence)} />
        </Card>
        <Card title="NIL Commercial Pipeline">
          <Stat label="Active partnerships" value={String(activeDeals)} hint="Contracts executing" />
          <Stat label="Completed earnings" value={formatCents(completedEarnings)} hint="Paid to date" />
          <p style={{ marginTop: 12 }}>
            <A href="/dashboard/deals">Browse brand marketplace →</A>
          </p>
        </Card>
        <Card title="Academic Gate & Alerts">
          {snap?.academics?.alerts.length ? (
            snap.academics.alerts.map((a) => (
              <p key={a.message}>
                <Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {a.message}
              </p>
            ))
          ) : (
            <Empty>{snap?.academics?.courses ? "All academic criteria clear for competition." : "Add your grades to start tracking eligibility."}</Empty>
          )}
          <p style={{ marginTop: 12 }}>
            <A href="/dashboard/academics">Open academic manager →</A>
          </p>
        </Card>
        <Card title="Setup & Brand Readiness" wide>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
            <span>Profile Completeness</span>
            <span style={{ fontWeight: 700 }}>
              {Math.round((completedSteps / steps.length) * 100)}% ({completedSteps}/{steps.length})
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--line)",
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: `${(completedSteps / steps.length) * 100}%`,
                height: "100%",
                background: "var(--primary)",
              }}
            />
          </div>
          <List
            items={steps.map(([ok, label, href]) => (
              <>
                {ok ? "✅" : "⬜"} {ok ? label : <A href={href}>{label}</A>}
              </>
            ))}
          />
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   2. Parent / Guardian Dashboard
   ========================================================================== */
async function Parent({ s }: { s: Session }) {
  const subs = await subjectsFor(s);
  const snaps = await snapshots(subs, todayStr());
  const pendingDeals = (await listDeals(s.userId)).filter((d) => d.status === "guardian_review");
  const grown = await grownAthletesOf(s.userId);

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Review Deals", href: "/dashboard/deals", icon: "✍️", primary: pendingDeals.length > 0, needs: pendingDeals.length > 0 },
          { label: "Academic Reports", href: "/dashboard/academics", icon: "🎓" },
          { label: "Travel Routes", href: "/dashboard/routes", icon: "✈️" },
          { label: "Team & Support", href: "/dashboard/team", icon: "👥" },
        ]}
      />

      {/* Guardian Trust & Protection Banner */}
      <div
        style={{
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          borderRadius: "var(--r)",
          padding: "12px 16px",
          marginBottom: 18,
        }}
      >
        <strong style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>🛡️</span> Guardian Legal Protection Active
        </strong>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text)" }}>
          Minor student-athlete protections are enforced. No contract, appearance, or financial agreement can execute
          without your verified digital signature. Payouts remain protected in escrow.
        </p>
      </div>

      <Grid>
        {grown.length > 0 && (
          <Card title="Now Adults (18+)" wide>
            <List
              items={grown.map((g) => (
                <>
                  {g.name} turned 18 —{" "}
                  {g.sharing
                    ? "they are sharing information with you (view-only)"
                    : "they control their own information now"}
                  . <A href="/dashboard/team">Review sharing permissions</A>
                </>
              ))}
            />
          </Card>
        )}
        <Card title="Pending Parental Decisions">
          {pendingDeals.length > 0 ? (
            <div>
              <p>
                <Badge tone="yellow">{pendingDeals.length}</Badge> deal
                {pendingDeals.length > 1 ? "s" : ""} awaiting your signature/approval.
              </p>
              <div style={{ marginTop: 12 }}>
                <Link href="/dashboard/deals" className="btn needs small">
                  Review & Sign Deals →
                </Link>
              </div>
            </div>
          ) : (
            <Empty>No deals waiting for your decision right now.</Empty>
          )}
        </Card>
        <Card title="Student-Athletes Under Care" wide>
          {snaps.length === 0 ? (
            <Empty>
              No athletes linked yet. Your child invites you by entering your email from their profile setup.
            </Empty>
          ) : (
            <Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} />
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   3. Coach Dashboard
   ========================================================================== */
async function Coach({ s }: { s: Session }) {
  const snaps = await snapshots(await subjectsFor(s), todayStr());
  const flagged = snaps.filter((r) => r.academics && !r.academics.gate).length;
  const cleared = snaps.filter((r) => r.academics?.gate).length;

  const events = (
    await db().query(
      `SELECT e.id, e.name, e.status, d.kind, d.starts_at, d.timezone, v.name AS venue_name
         FROM events e
         JOIN sports_event_details d ON d.event_id = e.id
         LEFT JOIN sports_venues v ON v.id = d.venue_id
        WHERE (e.organizer_id = $1 OR EXISTS(SELECT 1 FROM sports_attendees a WHERE a.event_id = e.id AND a.athlete_id = $1))
          AND d.starts_at >= now()
        ORDER BY d.starts_at ASC LIMIT 4`,
      [s.userId]
    )
  ).rows;

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Add Team Event", href: "/dashboard/events", icon: "📅", primary: true },
          { label: "Academic Clearance", href: "/dashboard/academics", icon: "🎓" },
          { label: "Invite Athlete", href: "/dashboard/team", icon: "📋" },
          { label: "Team Schedule", href: "/dashboard/schedule", icon: "🗓️" },
        ]}
      />
      <Grid>
        <Card title="Roster Readiness">
          <Stat label="Total Athletes" value={String(snaps.length)} />
          <Stat label="Cleared for Competition" value={String(cleared)} hint="Eligible to play" />
          <Stat label="Academic Block / At Risk" value={String(flagged)} hint="Competition gate locked" />
        </Card>
        <Card title="Upcoming Schedule">
          {events.length === 0 ? (
            <Empty>
              No upcoming games or practices scheduled. <A href="/dashboard/events">Add an event</A>.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Venue</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong> <span className="muted">({e.kind})</span>
                    </td>
                    <td>{new Date(e.starts_at).toLocaleDateString()}</td>
                    <td>{e.venue_name ?? "TBD"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Roster Status & Academic Gates" wide>
          {snaps.length === 0 ? (
            <Empty>
              No athletes have added you yet. Athletes invite coaches from their Team page.
            </Empty>
          ) : (
            <Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} />
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   4. Trainer Dashboard
   ========================================================================== */
async function Trainer({ s }: { s: Session }) {
  const snaps = await snapshots(await subjectsFor(s), todayStr());
  const d = (
    await db().query(
      "SELECT credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1",
      [s.userId]
    )
  ).rows[0];
  const alerts = snaps.filter((r) => r.health?.missedWeek);

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Assign Workout", href: "/dashboard/training", icon: "🏋️", primary: true },
          { label: "Prescribe Nutrition", href: "/dashboard/nutrition", icon: "🥗" },
          { label: "Athlete Adherence", href: "/dashboard/today", icon: "📊" },
        ]}
      />
      <Grid>
        <Card title="Client Roster">
          <Stat label="Active Athletes" value={String(snaps.length)} />
          <Stat
            label="Adherence Alert"
            value={String(alerts.length)}
            hint={alerts.length ? "2+ missed sessions this week" : "All athletes on track"}
          />
        </Card>
        <Card title="Professional Credential">
          {d ? (
            <div>
              <Badge tone={d.credential_verified ? "green" : "gray"}>{d.credential_type}</Badge>
              <p className="muted" style={{ marginTop: 8 }}>
                {d.credential_verified
                  ? "Credential verified by LIN."
                  : "Self-declared. Upload documentation for verified badge."}
              </p>
            </div>
          ) : (
            <Empty>No strength & conditioning credential on file. Add in settings.</Empty>
          )}
        </Card>
        {alerts.length > 0 && (
          <Card title="Intervention Needed (Missed Sessions)" wide>
            <List items={alerts.map((a) => `${a.name} missed 2+ workouts this week — follow up required`)} />
          </Card>
        )}
        <Card title="Training & Nutrition Adherence" wide>
          {snaps.length === 0 ? (
            <Empty>
              No clients assigned yet. Athletes invite trainers from their Team page.
            </Empty>
          ) : (
            <Roster rows={snaps} link={(r) => `/dashboard/training?athlete=${r.id}`} />
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   5. Manager / Agent Dashboard
   ========================================================================== */
async function Manager({ s }: { s: Session }) {
  const subs = await subjectsFor(s);
  const snaps = await snapshots(subs, todayStr());
  const d = (
    await db().query(
      "SELECT declared_role, credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1",
      [s.userId]
    )
  ).rows[0];

  const subIds = subs.map((x) => x.id);
  const deals = subIds.length
    ? (
        await db().query(
          `SELECT d.amount_cents, d.status FROM deals d WHERE d.athlete_id = ANY($1::uuid[])`,
          [subIds]
        )
      ).rows
    : [];

  const activeVol = deals
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + Number(r.amount_cents), 0);
  const estCommission = activeVol * 0.15; // standard 15% agency commission

  const items = snaps.flatMap((r) => [
    ...(r.academics?.alerts ?? []).map((a) => (
      <>
        <Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {r.name}: {a.message}
      </>
    )),
    ...(r.health?.missedWeek
      ? [
          <>
            <Badge tone="yellow">yellow</Badge> {r.name} missed 2+ sessions this week — intervention recommended
          </>
        ]
      : []),
  ]);

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "New NIL Deal", href: "/dashboard/deals/new", icon: "💼", primary: true },
          { label: "Signatures", href: "/dashboard/signing", icon: "✍️" },
          { label: "Compliance Center", href: "/dashboard/compliance", icon: "🛡️" },
          { label: "Operations & Travel", href: "/dashboard/operations", icon: "✈️" },
        ]}
      />
      <Grid>
        <Card title="Manager 360 Portfolio">
          <Stat label="Active Deal Volume" value={formatCents(activeVol)} hint="Client contract pool" />
          <Stat label="Est. Commission (15%)" value={formatCents(estCommission)} hint="Agency fee pipeline" />
          <Stat label="Clients Managed" value={String(snaps.length)} />
        </Card>
        <Card title="Accreditation & Role">
          {d ? (
            <div>
              <Badge tone="green">{String(d.declared_role).replace(/_/g, " ")}</Badge>
              {d.credential_type && <> <Badge tone="gray">{d.credential_type}</Badge></>}
              <p className="muted" style={{ marginTop: 8 }}>
                {d.credential_verified ? "Credential verified." : "Self-declared on file."}
              </p>
            </div>
          ) : (
            <Empty>No manager declaration on file.</Empty>
          )}
        </Card>
        <Card title="Holistic Client Interventions" wide>
          {items.length ? (
            <List items={items} />
          ) : (
            <Empty>
              {snaps.length ? "All clients are currently clear." : "No clients connected yet."}
            </Empty>
          )}
        </Card>
        {snaps.length > 0 && (
          <Card title="Managed Athletes Roster" wide>
            <Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} />
          </Card>
        )}
      </Grid>
    </>
  );
}

/* ==========================================================================
   6. Gym Owner / Team Organizer Dashboard
   ========================================================================== */
async function GymOwner({ s }: { s: Session }) {
  const deals = await listDeals(s.userId);
  const open = deals.filter((d) => isOpen(d.status));
  const active = deals.filter((d) => d.status === "active");

  const events = (
    await db().query(
      `SELECT e.id, e.name, e.status, d.kind, d.starts_at, d.timezone, v.name AS venue_name,
              (SELECT count(*)::int FROM sports_attendees a WHERE a.event_id = e.id) AS attendee_count
         FROM events e
         JOIN sports_event_details d ON d.event_id = e.id
         LEFT JOIN sports_venues v ON v.id = d.venue_id
        WHERE e.organizer_id = $1
        ORDER BY d.starts_at DESC LIMIT 5`,
      [s.userId]
    )
  ).rows;

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Host Open Run / Event", href: "/dashboard/events", icon: "🏟️", primary: true },
          { label: "Offer Athlete Deal", href: "/dashboard/deals/new", icon: "🤝" },
          { label: "Travel & Venues", href: "/dashboard/routes", icon: "📍" },
        ]}
      />
      <Grid>
        <Card title="Facility & Event Hub">
          <Stat label="Hosted Events" value={String(events.length)} hint="Combines, open runs, camps" />
          <Stat
            label="Total Attendees"
            value={String(events.reduce((acc, ev) => acc + (ev.attendee_count ?? 0), 0))}
            hint="Athletes registered"
          />
        </Card>
        <Card title="Facility Sponsorships">
          <Stat label="Active Ambassadors" value={String(active.length)} hint="Athletes repping gym" />
          <Stat label="Open Offers" value={String(open.length)} hint="Awaiting signatures" />
        </Card>
        <Card title="Scheduled Facility Events & Combines" wide>
          {events.length === 0 ? (
            <Empty>
              No facility events scheduled yet. <A href="/dashboard/events">Host your first combine or open run</A>.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Format</th>
                  <th>Date</th>
                  <th>Registered</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <strong>{ev.name}</strong>
                    </td>
                    <td>{ev.kind}</td>
                    <td>{new Date(ev.starts_at).toLocaleDateString()}</td>
                    <td>{ev.attendee_count ?? 0} athletes</td>
                    <td>
                      <Badge tone={ev.status === "published" ? "green" : "gray"}>{ev.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   7. Sponsor Dashboard
   ========================================================================== */
async function Sponsor({ s }: { s: Session }) {
  const deals = await listDeals(s.userId);
  const open = deals.filter((d) => isOpen(d.status));
  const active = deals.filter((d) => d.status === "active");
  const completed = deals.filter((d) => d.status === "completed");

  const totalCommitted = deals.reduce((sum, d) => sum + d.amount_cents, 0);
  const activeSpend = active.reduce((sum, d) => sum + d.amount_cents, 0);

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Launch NIL Campaign", href: "/dashboard/deals/new", icon: "🚀", primary: true },
          { label: "Find Athletes", href: "/dashboard/athletes", icon: "🔍" },
          { label: "Review Deliverables", href: "/dashboard/deals", icon: "📑" },
        ]}
      />
      <Grid>
        <Card title="Campaign Investment">
          <Stat label="Active NIL Deals" value={String(active.length)} hint={formatCents(activeSpend)} />
          <Stat label="Total Committed" value={formatCents(totalCommitted)} hint="Cumulative NIL budget" />
          <Stat label="Completed Campaigns" value={String(completed.length)} />
        </Card>
        <Card title="Campaign Funnel">
          <Stat label="Offers in Review" value={String(open.length)} hint="Awaiting athlete / parent" />
          <Stat label="Active Deliverables" value={String(active.length)} hint="Posts, appearances, camps" />
          <p style={{ marginTop: 12 }}>
            <A href="/dashboard/deals">Manage all campaigns →</A>
          </p>
        </Card>
        <Card title="Brand Safety & Compliance Guarantee" wide>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🛡️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 650 }}>Verifiable Deliverables & FTC Compliance</p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                Every partnership on LIN includes time-stamped proof of performance (deliverables upload), guardian
                signatures for minors, and complete audit histories for collegiate and high school compliance.
              </p>
            </div>
          </div>
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   8. Booster / Collective Dashboard
   ========================================================================== */
async function Booster({ s }: { s: Session }) {
  const deals = await listDeals(s.userId);
  const active = deals.filter((d) => d.status === "active");
  const totalMobilized = deals.reduce((sum, d) => sum + d.amount_cents, 0);

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Support Student-Athlete", href: "/dashboard/deals/new", icon: "🤝", primary: true },
          { label: "Browse Collective Roster", href: "/dashboard/athletes", icon: "🔍" },
          { label: "Compliance & Rules", href: "/dashboard/compliance", icon: "🛡️" },
        ]}
      />
      <Grid>
        <Card title="NIL Collective Fund">
          <Stat label="Funds Mobilized" value={formatCents(totalMobilized)} hint="Direct athlete support" />
          <Stat label="Athletes Supported" value={String(deals.length)} hint="Active and completed" />
          <Stat label="Active Agreements" value={String(active.length)} />
        </Card>
        <Card title="Fair Market Value & Compliance" wide>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚖️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 650 }}>Genuine Deliverables Required (No Pay-for-Play)</p>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                To maintain student-athlete NCAA and state amateurism eligibility, all collective funds require genuine
                quid-pro-quo deliverables (community clinics, charity appearances, personal brand promotions).
              </p>
            </div>
          </div>
        </Card>
        <Card title="Supported Athletes Roster" wide>
          {deals.length === 0 ? (
            <Empty>
              No active student-athlete support agreements yet. <A href="/dashboard/athletes">Discover athletes to support</A>.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Athlete</th>
                  <th>Deliverables</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <A href={`/dashboard/deals/${d.id}`}>{d.athlete_name}</A>
                    </td>
                    <td>{d.deliverables}</td>
                    <td>{formatCents(d.amount_cents)}</td>
                    <td>
                      <Badge tone={d.status === "active" ? "green" : "gray"}>{d.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   9. Tournament Manager Dashboard
   ========================================================================== */
async function TournamentManager({ s }: { s: Session }) {
  const ev = (
    await db().query(
      `SELECT e.id, e.name, e.status, e.sport, d.kind, d.starts_at, d.ends_at, d.timezone, v.name AS venue_name,
              (SELECT count(*)::int FROM sports_attendees a WHERE a.event_id = e.id) AS attendee_count
         FROM events e
         JOIN sports_event_details d ON d.event_id = e.id
         LEFT JOIN sports_venues v ON v.id = d.venue_id
        WHERE e.organizer_id = $1 AND e.status <> 'cancelled'
        ORDER BY d.starts_at ASC LIMIT 6`,
      [s.userId]
    )
  ).rows;

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Create Tournament", href: "/dashboard/events", icon: "🏆", primary: true },
          { label: "Schedule Games", href: "/dashboard/events", icon: "🗓️" },
          { label: "Travel Coordination", href: "/dashboard/routes", icon: "📍" },
        ]}
      />
      <Grid>
        <Card title="Tournament Command Center">
          <Stat label="Active Events" value={String(ev.length)} hint="Tournaments & showcases" />
          <Stat
            label="Registered Athletes"
            value={String(ev.reduce((acc, x) => acc + (x.attendee_count ?? 0), 0))}
            hint="Across scheduled events"
          />
        </Card>
        <Card title="Tournament & Showcase Schedule" wide>
          {ev.length === 0 ? (
            <Empty>
              No upcoming tournaments or combines. <A href="/dashboard/events">Create a new tournament</A>.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tournament / Event</th>
                  <th>Sport / Kind</th>
                  <th>Dates</th>
                  <th>Venue</th>
                  <th>Registered</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ev.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                    </td>
                    <td>
                      {e.sport ?? "Multi-Sport"} · {e.kind}
                    </td>
                    <td>
                      {new Date(e.starts_at).toLocaleDateString()} – {new Date(e.ends_at).toLocaleDateString()}
                    </td>
                    <td>{e.venue_name ?? "TBD"}</td>
                    <td>{e.attendee_count ?? 0} athletes</td>
                    <td>
                      <Badge tone={e.status === "published" ? "green" : "gray"}>{e.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   10. Recruiter Dashboard
   ========================================================================== */
async function Recruiter({ s }: { s: Session }) {
  const board = (
    await db().query(
      `SELECT b.id, b.stage, u.id AS athlete_id, u.full_name, ap.sport, ap.position, ap.level, ap.grad_year,
              ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
         FROM recruiting_board b
         JOIN users u ON u.id = b.athlete_id
         JOIN athlete_profiles ap ON ap.user_id = u.id
        WHERE b.recruiter_id=$1 AND ap.discoverable AND u.email_verified_at IS NOT NULL
          AND u.deleted_at IS NULL AND u.suspended_at IS NULL
          AND (ap.birth_date<=CURRENT_DATE-INTERVAL '18 years' OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=u.id))
          AND NOT ${BLOCKED_SQL("u.id", "$1::uuid")}
        ORDER BY b.updated_at DESC`,
      [s.userId]
    )
  ).rows;

  const snaps = new Map(
    (
      await snapshots(
        (await subjectsFor(s)).filter((x) => board.some((b) => b.athlete_id === x.id)),
        todayStr()
      )
    ).map((x) => [x.id, x])
  );

  const stages = {
    watching: board.filter((b) => b.stage === "watching").length,
    evaluating: board.filter((b) => b.stage === "evaluating").length,
    contacted: board.filter((b) => b.stage === "contacted").length,
    passed: board.filter((b) => b.stage === "passed").length,
  };

  return (
    <>
      <ActionToolbar
        actions={[
          { label: "Private Scouting Board", href: "/dashboard/scouting", icon: "📋", primary: true },
          { label: "Side-by-Side Matrix", href: "/dashboard/scouting", icon: "⚖️" },
          { label: "Discover Athletes", href: "/dashboard/athletes", icon: "🔍" },
        ]}
      />
      <Grid>
        <Card title="Recruiting Pipeline">
          <Stat label="Watching" value={String(stages.watching)} hint="Monitoring progress" />
          <Stat label="Evaluating" value={String(stages.evaluating)} hint="Film & stats review" />
          <Stat label="Contacted" value={String(stages.contacted)} hint="In active dialogue" />
        </Card>
        <Card title="Side-by-Side Comparison">
          <p>Compare prospects side-by-side on measurables, class, academic eligibility, and stage.</p>
          <A href="/dashboard/scouting">Open Comparison Matrix →</A>
        </Card>
        <Card title="Tracked Prospects" wide>
          {board.length === 0 ? (
            <Empty>
              Your recruiting board is empty. <A href="/dashboard/athletes">Discover athletes</A> to track.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Prospect</th>
                  <th>Sport / Position</th>
                  <th>Class</th>
                  <th>Academics</th>
                  <th>Stage</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {board.map((b) => {
                  const a = snaps.get(b.athlete_id)?.academics;
                  return (
                    <tr key={b.id}>
                      <td>
                        <A href={`/dashboard/scouting/${b.athlete_id}`}>
                          {snaps.has(b.athlete_id) ? b.full_name : displayName(b.full_name, b.minor)}
                        </A>
                      </td>
                      <td>
                        {b.sport}
                        {b.position ? ` · ${b.position}` : ""}
                      </td>
                      <td>{b.grad_year ?? "—"}</td>
                      <td>
                        {a ? (
                          <>
                            {a.avg != null ? `${a.avg}% avg ` : ""}
                            <Badge tone={a.gate ? "green" : "yellow"}>
                              {a.gate ? "Eligible" : "At risk"}
                            </Badge>
                          </>
                        ) : (
                          <span className="muted">not shared</span>
                        )}
                      </td>
                      <td>
                        <form action={setStage} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="id" value={b.id} />
                          <label className="sr-only" htmlFor={`stage-select-${b.id}`}>Recruiting Stage</label>
                          <select
                            id={`stage-select-${b.id}`}
                            name="stage"
                            defaultValue={b.stage}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid var(--line)",
                              background: "var(--panel)",
                              color: "var(--text)",
                              fontSize: 12,
                            }}
                          >
                            {["watching", "evaluating", "contacted", "passed"].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                          <button className="btn ghost small" type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                      <td>
                        <form action={untrack}>
                          <input type="hidden" name="id" value={b.id} />
                          <button className="btn ghost small" type="submit">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </Grid>
    </>
  );
}

/* ==========================================================================
   Master Role Router
   ========================================================================== */
export async function RoleDashboard({ session: s }: { session: Session }) {
  switch (s.role) {
    case "athlete":
      return <Athlete s={s} />;
    case "parent":
      return <Parent s={s} />;
    case "coach":
      return <Coach s={s} />;
    case "trainer":
      return <Trainer s={s} />;
    case "manager":
      return <Manager s={s} />;
    case "gym_owner":
      return <GymOwner s={s} />;
    case "sponsor":
      return <Sponsor s={s} />;
    case "booster":
      return <Booster s={s} />;
    case "tournament_manager":
      return <TournamentManager s={s} />;
    case "recruiter":
      return <Recruiter s={s} />;
  }
}

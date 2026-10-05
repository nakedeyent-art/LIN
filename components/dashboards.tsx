import type { ReactNode } from "react";
import type { Role } from "@/lib/roles";
import { Badge, Card, Grid, List, Stat } from "./ui";
import { athlete, board, compliance14d, courses, studyLog, weekStatuses } from "@/lib/mock";
import { gradeAlerts, missedSessionAlert } from "@/lib/calc";

const alerts = gradeAlerts(courses);
const missedAlert = missedSessionAlert(weekStatuses);

const Athlete = () => (
  <Grid>
    <Card title="My NIL Profile">
      <Stat label="Estimated NIL value" value={`$${athlete.nilValue.toLocaleString()}`} hint="Based on reach, performance, local market" />
      <Stat label="Followers" value={`${(athlete.followers / 1000).toFixed(1)}K`} />
    </Card>
    <Card title="Today">
      <List items={["Training: Deceleration session (Phase 3 next)", "Study block: 45 min — Core Math", "Log lunch & pre-practice meal"]} />
    </Card>
    <Card title="Competition Landscape">
      <List items={["#14 of 212 PGs in TX class of 2027 (NIL value)", "Top comparable: 22K followers, $15K est.", "Gap to close: +3.6K followers"]} />
    </Card>
    <Card title="Eligibility Gate" wide>
      {alerts.length ? alerts.map((a) => <p key={a.message}><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {a.message}</p>) : <p>All clear.</p>}
    </Card>
  </Grid>
);

const Parent = () => (
  <Grid>
    <Card title="Eligibility & Academics">
      <Stat label="Core Math" value="74%" hint="Yellow alert — threshold at risk" />
      <Stat label="Study this week" value={`${studyLog.minutesThisWeek} min`} />
    </Card>
    <Card title="Health & Safety">
      <Stat label="Macro compliance (14d)" value={`${compliance14d}%`} />
      <p className="muted">Plans must come from CSCS-certified coaches or Registered Dietitians.</p>
    </Card>
    <Card title="Learn the Rules">
      <List items={["What NIL means for HS athletes in TX", "How agent agreements are disclosed", "Tax basics for NIL income"]} />
    </Card>
  </Grid>
);

const Coach = () => (
  <Grid>
    <Card title="Roster Eligibility"><Stat label="Eligible" value="11 / 13" hint="2 academic alerts" /></Card>
    <Card title="Readiness"><Stat label="Training adherence" value="88%" /><p className="muted">Athlete-level health data shared only with consent.</p></Card>
    <Card title="NIL Compliance"><List items={["3 deals disclosed this month", "0 flagged conflicts", "Booster activity: within policy"]} /></Card>
    <Card title="Program Exposure"><List items={["2 recruiter views this week", "Showcase invite received"]} /></Card>
  </Grid>
);

const Trainer = () => (
  <Grid>
    <Card title="Clients Today"><Stat label="Sessions scheduled" value="6" /></Card>
    <Card title="Needs Attention"><List items={[missedAlert ? "Jordan R. missed 2 sessions this week" : "No missed-session alerts", "2 form videos awaiting annotation"]} /></Card>
    <Card title="Program Builder"><p>Build periodized blocks by sport, position, and target adaptation.</p></Card>
    <Card title="Credentials"><Badge tone="green">CSCS verified</Badge></Card>
  </Grid>
);

const GymOwner = () => (
  <Grid>
    <Card title="Facility"><Stat label="Active members" value="212" /><Stat label="Monthly revenue" value="$18.4K" /></Card>
    <Card title="Teams & Events"><List items={["3 travel teams registered", "Open gym night — Fri 7 PM"]} /></Card>
    <Card title="Local Sponsors"><List items={["Sponsor placement opportunities: 4", "Pending proposals: 2"]} /></Card>
    <Card title="Athlete Spotlight"><p>Feature rising athletes to raise facility and athlete exposure.</p></Card>
  </Grid>
);

const Sponsor = () => (
  <Grid>
    <Card title="Athlete Discovery" wide>
      <table><thead><tr><th>Athlete</th><th>Sport</th><th>Reach</th><th>Brand fit</th></tr></thead>
        <tbody>{board.sponsorPipeline.map((a) => <tr key={a.name}><td>{a.name}</td><td>{a.sport}</td><td>{a.reach}</td><td>{a.fit}%</td></tr>)}</tbody></table>
    </Card>
    <Card title="Campaigns"><Stat label="Active" value="2" /><Stat label="Avg engagement" value="4.8%" /></Card>
    <Card title="Budget"><Stat label="Committed" value="$22K" hint="of $40K" /></Card>
  </Grid>
);

const Booster = () => (
  <Grid>
    <Card title="Collective Fund"><Stat label="Pool balance" value="$85K" /><Stat label="Donors" value="143" /></Card>
    <Card title="Proposed Allocations"><List items={["Basketball — 5 athletes, $30K", "Soccer — 3 athletes, $12K"]} /></Card>
    <Card title="Compliance"><p>Every payout needs a documented, fair-market-value deliverable.</p></Card>
  </Grid>
);

const TournamentManager = () => (
  <Grid>
    <Card title="My Events" wide>
      <table><thead><tr><th>Event</th><th>Teams</th><th>Status</th></tr></thead>
        <tbody>{board.events.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.teams}</td><td>{e.status}</td></tr>)}</tbody></table>
    </Card>
    <Card title="Recruiter Attendance"><Stat label="Registered" value="19" /></Card>
    <Card title="Sponsor Slots"><Stat label="Filled" value="6 / 10" /></Card>
  </Grid>
);

const Recruiter = () => (
  <Grid>
    <Card title="Recruiting Board" wide>
      <table><thead><tr><th>Prospect</th><th>Pos</th><th>GPA</th><th>Eligibility</th><th>Stage</th></tr></thead>
        <tbody>{board.recruitBoard.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.pos}</td><td>{p.gpa}</td>
          <td><Badge tone={p.status === "Eligible" ? "green" : "yellow"}>{p.status}</Badge></td><td>{p.stage}</td></tr>)}</tbody></table>
    </Card>
    <Card title="Contact Rules"><p className="muted">Contact windows and dead periods by sport/association shown here.</p></Card>
  </Grid>
);

const Manager = () => (
  <Grid>
    <Card title="Client Alerts" wide>
      <List items={[
        ...alerts.map((a) => <><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> Jordan R.: {a.message}</>),
        ...(missedAlert ? [<><Badge tone="yellow">yellow</Badge> Jordan R. missed 2 sessions this week — intervene</>] : []),
      ]} />
    </Card>
    <Card title="Deal Pipeline"><Stat label="Open offers" value="2" /><Stat label="Pending value" value="$5.5K" /></Card>
    <Card title="Macro Compliance"><Stat label="Jordan R. (14d)" value={`${compliance14d}%`} /></Card>
    <Card title="Your Declared Role"><Badge tone="green">Marketing Agent</Badge><p className="muted">Training/nutrition prescriptions require a verified CSCS/RD credential.</p></Card>
  </Grid>
);

const MAP: Record<Role, () => ReactNode> = {
  athlete: Athlete, parent: Parent, coach: Coach, trainer: Trainer, gym_owner: GymOwner,
  sponsor: Sponsor, booster: Booster, tournament_manager: TournamentManager, recruiter: Recruiter, manager: Manager,
};

export function RoleDashboard({ role }: { role: Role }) {
  const D = MAP[role];
  return <D />;
}

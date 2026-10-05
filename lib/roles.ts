export type Role =
  | "athlete" | "parent" | "coach" | "trainer" | "gym_owner"
  | "sponsor" | "booster" | "tournament_manager" | "recruiter" | "manager";

export type NavItem = { href: string; label: string };

export type RoleConfig = {
  id: Role;
  label: string;
  tagline: string;
  accent: string;
  nav: NavItem[];
};

const dev = {
  academics: { href: "/dashboard/academics", label: "Academics" },
  nutrition: { href: "/dashboard/nutrition", label: "Nutrition" },
  training: { href: "/dashboard/training", label: "Training" },
  compliance: { href: "/dashboard/compliance", label: "Compliance" },
};
const deals = { href: "/dashboard/deals", label: "Deals" };
const athletes = { href: "/dashboard/athletes", label: "Find Athletes" };
const home = { href: "/dashboard", label: "Home" };

export const ROLES: Record<Role, RoleConfig> = {
  athlete: { id: "athlete", label: "Athlete", accent: "#f97316",
    tagline: "Your brand, your development, your deals.",
    nav: [home, deals, dev.training, dev.nutrition, dev.academics, dev.compliance] },
  parent: { id: "parent", label: "Parent / Guardian", accent: "#14b8a6",
    tagline: "Approve deals, protect eligibility, stay informed.",
    nav: [home, deals, dev.academics, dev.nutrition, dev.compliance] },
  coach: { id: "coach", label: "Coach", accent: "#3b82f6",
    tagline: "Roster readiness and NIL-compliant program visibility.",
    nav: [home, dev.academics, dev.training, dev.compliance] },
  trainer: { id: "trainer", label: "Trainer", accent: "#ef4444",
    tagline: "Prescribe, track and correct athlete training.",
    nav: [home, dev.training, dev.nutrition, dev.compliance] },
  gym_owner: { id: "gym_owner", label: "Gym Owner / Team Organizer", accent: "#a855f7",
    tagline: "Run your facility, teams and events.",
    nav: [home, athletes, deals, dev.compliance] },
  sponsor: { id: "sponsor", label: "Sponsor", accent: "#eab308",
    tagline: "Find athletes, run campaigns, measure return.",
    nav: [home, athletes, deals, dev.compliance] },
  booster: { id: "booster", label: "Booster / Collective", accent: "#22c55e",
    tagline: "Pool funds, back athletes, stay compliant.",
    nav: [home, athletes, deals, dev.compliance] },
  tournament_manager: { id: "tournament_manager", label: "Tournament Manager", accent: "#06b6d4",
    tagline: "Events, brackets, exposure and sponsor placement.",
    nav: [home, dev.compliance] },
  recruiter: { id: "recruiter", label: "Recruiter", accent: "#ec4899",
    tagline: "Discover, evaluate and track prospects.",
    nav: [home, dev.academics, dev.compliance] },
  manager: { id: "manager", label: "Manager / Agent", accent: "#8b5cf6",
    tagline: "Athlete Development & Representation OS.",
    nav: [home, dev.academics, dev.nutrition, dev.training, dev.compliance] },
};

export const ROLE_LIST = Object.values(ROLES);
export const isRole = (v: string | undefined): v is Role => !!v && v in ROLES;

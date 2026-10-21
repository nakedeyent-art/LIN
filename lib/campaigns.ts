/**
 * NIL Campaign Marketplace & Opportunity Matching Logic.
 * Pure domain logic for filtering, ranking, and eligibility checking.
 */

export type CampaignCategory =
  | "All Categories"
  | "Social Media"
  | "Appearance"
  | "Ambassador"
  | "Product Testing"
  | "Clinic Lead";

export type CampaignOpportunity = {
  id: string;
  title: string;
  sponsorName: string;
  sponsorRole: "sponsor" | "booster" | "gym_owner";
  category: "Social Media" | "Appearance" | "Ambassador" | "Product Testing" | "Clinic Lead";
  sport: string;
  level: "All Levels" | "College Only" | "High School & College";
  compensation: string;
  compensationCents: number;
  deliverables: string;
  deadlineDays: number;
  featured?: boolean;
};

export const DEFAULT_OPPORTUNITIES: CampaignOpportunity[] = [
  {
    id: "opp-1",
    title: "Apex Hydration Match-Day Social Campaign",
    sponsorName: "Apex Performance Hydration",
    sponsorRole: "sponsor",
    category: "Social Media",
    sport: "All Sports",
    level: "High School & College",
    compensation: "$750",
    compensationCents: 75000,
    deliverables: "2 TikTok/Instagram Reels featuring match-day prep drink + 1 story link with discount code.",
    deadlineDays: 14,
    featured: true,
  },
  {
    id: "opp-2",
    title: "Metro Elite Youth Basketball Clinic Lead Coach",
    sponsorName: "Metro Hoops Training Facility",
    sponsorRole: "gym_owner",
    category: "Clinic Lead",
    sport: "Basketball",
    level: "High School & College",
    compensation: "$1,200",
    compensationCents: 120000,
    deliverables: "Co-host a 3-hour Saturday youth camp session, demonstrate shooting mechanics, photo session with attendees.",
    deadlineDays: 8,
    featured: true,
  },
  {
    id: "opp-3",
    title: "State Student-Athlete Collective Community Grant",
    sponsorName: "Champions NIL Collective",
    sponsorRole: "booster",
    category: "Ambassador",
    sport: "All Sports",
    level: "College Only",
    compensation: "$2,500",
    compensationCents: 250000,
    deliverables: "Quarterly community service attendance, 1 collective podcast appearance, and brand advocate tagging.",
    deadlineDays: 21,
    featured: true,
  },
  {
    id: "opp-4",
    title: "Veloce Grip Speed Cleats Wear-Test & Review",
    sponsorName: "Veloce Athletic Gear",
    sponsorRole: "sponsor",
    category: "Product Testing",
    sport: "Football",
    level: "All Levels",
    compensation: "$450 + Free Cleats ($280 value)",
    compensationCents: 45000,
    deliverables: "4-week wear testing log, unboxing short video, and feedback questionnaire for product engineering team.",
    deadlineDays: 5,
  },
  {
    id: "opp-5",
    title: "Iron Core Gym Local Athlete Billboard & Social Feature",
    sponsorName: "Iron Core Strength Hub",
    sponsorRole: "gym_owner",
    category: "Appearance",
    sport: "All Sports",
    level: "High School & College",
    compensation: "$1,000 + 1-Year Facility Access",
    compensationCents: 100000,
    deliverables: "1-hour photo/video shoot at facility, permission for local banner, and 2 co-branded Instagram posts.",
    deadlineDays: 18,
  },
  {
    id: "opp-6",
    title: "BioRecovery Compression Sleeves Brand Ambassador",
    sponsorName: "BioRecovery Health",
    sponsorRole: "sponsor",
    category: "Ambassador",
    sport: "Track",
    level: "All Levels",
    compensation: "$600 / month",
    compensationCents: 60000,
    deliverables: "Monthly unboxing and recovery breakdown reels, bio link placement, and discount tracking.",
    deadlineDays: 12,
  },
];

export function filterOpportunities(
  opportunities: CampaignOpportunity[],
  options: {
    sport?: string;
    category?: string;
    isMinor?: boolean;
    searchTerm?: string;
  }
): CampaignOpportunity[] {
  return opportunities.filter((opp) => {
    // Sport match
    if (options.sport && options.sport !== "All Sports") {
      if (opp.sport !== "All Sports" && opp.sport !== options.sport) return false;
    }

    // Category match
    if (options.category && options.category !== "All Categories") {
      if (opp.category !== options.category) return false;
    }

    // Minor eligibility: minors cannot take "College Only" deals
    if (options.isMinor && opp.level === "College Only") {
      return false;
    }

    // Search term in title, sponsor, deliverables
    if (options.searchTerm && options.searchTerm.trim()) {
      const q = options.searchTerm.toLowerCase();
      const match =
        opp.title.toLowerCase().includes(q) ||
        opp.sponsorName.toLowerCase().includes(q) ||
        opp.deliverables.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });
}

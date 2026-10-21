/**
 * NIL Valuation, Deliverable Pricing, and 1099 Tax Suite
 * Pure domain logic for collegiate, scholastic, and independent NIL financial management.
 */

export type SocialReach = {
  igFollowers: number;
  tiktokFollowers: number;
  xFollowers: number;
  engagementRate: number; // percentage, e.g. 4.8%
};

export type DeliverablePricing = {
  totalReach: number;
  engagementFactor: number;
  reelPrice: number;
  staticPostPrice: number;
  storySeriesPrice: number;
  appearancePrice: number;
  monthlyRetainerPrice: number;
};

export function calculateDeliverablesPricing(reach: SocialReach): DeliverablePricing {
  const ig = Math.max(0, reach.igFollowers || 0);
  const tt = Math.max(0, reach.tiktokFollowers || 0);
  const x = Math.max(0, reach.xFollowers || 0);
  const totalReach = ig + tt + x;

  // Active athletic creators command ~$25 - $40 CPM per 1,000 followers, scaled by engagement factor
  const engagementFactor = Math.max(0.7, (reach.engagementRate || 0) / 4.0);

  const reelPrice = Math.max(150, Math.round((totalReach * 0.035 * engagementFactor) / 25) * 25);
  const staticPostPrice = Math.max(100, Math.round((ig * 0.025 * engagementFactor) / 25) * 25);
  const storySeriesPrice = Math.max(75, Math.round((ig * 0.015 * engagementFactor) / 25) * 25);
  const appearancePrice = Math.max(300, Math.round((250 + totalReach * 0.02) / 50) * 50);
  const monthlyRetainerPrice = Math.max(500, Math.round((reelPrice * 2 + storySeriesPrice * 3 + 200) / 100) * 100);

  return {
    totalReach,
    engagementFactor,
    reelPrice,
    staticPostPrice,
    storySeriesPrice,
    appearancePrice,
    monthlyRetainerPrice,
  };
}

export function generateMediaKitText(params: {
  athleteName?: string;
  sport?: string;
  position?: string;
  level?: string;
  reach: SocialReach;
  pricing: DeliverablePricing;
}): string {
  const { athleteName, sport, position, level, reach, pricing } = params;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return `
NIL BRAND RATE CARD & MEDIA KIT
Athlete: ${athleteName ?? "Student-Athlete"}
Sport / Position: ${sport ?? "Multi-Sport"} ${position ? `· ${position}` : ""}
Level: ${level ? level.replace(/_/g, " ") : "Varsity"}

AUDIENCE REACH
- Total Social Reach: ${pricing.totalReach.toLocaleString()} followers
- Instagram: ${reach.igFollowers.toLocaleString()}
- TikTok: ${reach.tiktokFollowers.toLocaleString()}
- X / Twitter: ${reach.xFollowers.toLocaleString()}
- Avg Engagement Rate: ${reach.engagementRate}% (Industry benchmark: 2.5%)

STANDARD RATE CARD
1. Dedicated TikTok / IG Reel: ${fmt(pricing.reelPrice)}
2. Static Feed Post + Story Series: ${fmt(pricing.staticPostPrice)}
3. In-Person Appearance / Clinic (2h): ${fmt(pricing.appearancePrice)}
4. 3-Month Ambassador Retainer: ${fmt(pricing.monthlyRetainerPrice)}/mo

Deliverables include usage rights, FTC disclosure compliance, and performance metrics proof.
Inquiries: Contact athlete management via LIN NIL Ecosystem.
  `.trim();
}

export type StateTaxRate = {
  name: string;
  code: string;
  rate: number;
};

export const STATE_RATES: StateTaxRate[] = [
  { name: "Florida (No State Tax)", code: "FL", rate: 0.0 },
  { name: "Texas (No State Tax)", code: "TX", rate: 0.0 },
  { name: "Tennessee (No State Tax)", code: "TN", rate: 0.0 },
  { name: "California", code: "CA", rate: 0.08 },
  { name: "New York", code: "NY", rate: 0.065 },
  { name: "Ohio", code: "OH", rate: 0.035 },
  { name: "North Carolina", code: "NC", rate: 0.0475 },
  { name: "Georgia", code: "GA", rate: 0.0549 },
  { name: "Illinois", code: "IL", rate: 0.0495 },
  { name: "Other States (Avg 5%)", code: "OTHER", rate: 0.05 },
];

export type TaxBreakdown = {
  gross: number;
  agencyFeePct: number;
  agentFee: number;
  netBeforeTax: number;
  seTax: number;
  fedTax: number;
  stateTax: number;
  totalTaxes: number;
  netTakeHome: number;
  recommendedReservePct: number;
  quarterlyEstimatedTax: number;
};

export function calculateTaxBreakdown(
  grossAmount: number,
  stateCode: string = "FL",
  agencyFeePct: number = 15
): TaxBreakdown {
  const gross = Math.max(0, grossAmount || 0);
  const selectedState = STATE_RATES.find((s) => s.code === stateCode) ?? STATE_RATES[0];
  const feePct = Math.max(0, Math.min(100, agencyFeePct));

  const agentFee = gross * (feePct / 100);
  const netBeforeTax = gross - agentFee;

  // Self-Employment Tax: 15.3% on 92.35% of net business earnings
  const seTaxable = netBeforeTax * 0.9235;
  const seTax = seTaxable * 0.153;

  // Estimated Federal Income Tax (conservative standard effective rate of ~12% for typical NIL bracket)
  // Standard deduction ~$14,600 and SE tax deduction (50% of SE tax)
  const fedTax = Math.max(0, (netBeforeTax - seTax * 0.5 - 14600) * 0.12);

  // State Tax
  const stateTax = netBeforeTax * selectedState.rate;

  const totalTaxes = seTax + fedTax + stateTax;
  const netTakeHome = netBeforeTax - totalTaxes;
  const recommendedReservePct = gross > 0 ? Math.round((totalTaxes / gross) * 100) : 30;
  const quarterlyEstimatedTax = totalTaxes / 4;

  return {
    gross,
    agencyFeePct: feePct,
    agentFee,
    netBeforeTax,
    seTax,
    fedTax,
    stateTax,
    totalTaxes,
    netTakeHome,
    recommendedReservePct,
    quarterlyEstimatedTax,
  };
}

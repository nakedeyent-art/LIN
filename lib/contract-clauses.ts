/**
 * NIL Contract Clause & Term Sheet Generator
 * Pure domain logic for assembling compliant collegiate, scholastic, and brand NIL agreements.
 * Adheres to FTC 16 CFR Part 255 disclosures, NCAA amateurism rules, and minor guardian protection.
 */

export type ExclusivityScope =
  | "non_exclusive"
  | "apparel_footwear"
  | "beverage_hydration"
  | "supplements_nutrition"
  | "fitness_facility";

export type CampaignPreset =
  | "social_ambassador"
  | "in_person_clinic"
  | "product_review"
  | "collective_grant";

export type ClauseBuilderOptions = {
  preset: CampaignPreset;
  athleteName?: string;
  sponsorName?: string;
  isMinor?: boolean;
  ftcDisclosure?: boolean;
  schoolMarksProtection?: boolean;
  moralsClause?: boolean;
  exclusivity?: ExclusivityScope;
  deliverableProofGate?: boolean;
  specificDeliverables?: string;
  campaignDurationDays?: number;
};

export const CLAUSE_PRESETS: Record<
  CampaignPreset,
  {
    title: string;
    suggestedAmount: number;
    defaultDeliverables: string;
    description: string;
  }
> = {
  social_ambassador: {
    title: "Social Media Ambassador Campaign",
    suggestedAmount: 750,
    defaultDeliverables: "2 TikTok/Instagram Reels and 1 Story series with bio link and trackable promo code.",
    description: "Multi-platform digital marketing campaign focused on engagement and audience reach.",
  },
  in_person_clinic: {
    title: "Youth Skills Clinic & Appearance",
    suggestedAmount: 1200,
    defaultDeliverables: "Lead guest coach for 2-hour youth skills session, 30-min autograph/photo session.",
    description: "In-person athletic instruction, guest coaching, or community event attendance.",
  },
  product_review: {
    title: "Product Wear-Test & Digital Review",
    suggestedAmount: 500,
    defaultDeliverables: "4-week gear wear-testing log, 1 dedicated video unboxing/review, product feedback report.",
    description: "Athletic gear or supplement testing with honest athlete feedback and digital content.",
  },
  collective_grant: {
    title: "Student-Athlete Collective Ambassador",
    suggestedAmount: 2500,
    defaultDeliverables: "Quarterly charity appearance, collective podcast guest feature, and community advocacy posts.",
    description: "Booster collective engagement tied to genuine community service and charitable promotion.",
  },
};

export const EXCLUSIVITY_DESCRIPTIONS: Record<ExclusivityScope, string> = {
  non_exclusive: "Non-Exclusive: Athlete may collaborate with any other brand or sponsor.",
  apparel_footwear: "Category Exclusive: No competing athletic footwear or sportswear endorsements.",
  beverage_hydration: "Category Exclusive: No competing sports hydration, energy drink, or beverage deals.",
  supplements_nutrition: "Category Exclusive: No competing protein, vitamin, or dietary supplement partnerships.",
  fitness_facility: "Category Exclusive: No competing gym, fitness facility, or strength hub appearances.",
};

export function buildContractTerms(opts: ClauseBuilderOptions): string {
  const parts: string[] = [];

  // Core Deliverables Scope
  const coreDeliverables =
    opts.specificDeliverables && opts.specificDeliverables.trim()
      ? opts.specificDeliverables.trim()
      : CLAUSE_PRESETS[opts.preset].defaultDeliverables;

  parts.push(`1. SCOPE OF DELIVERABLES:\n${coreDeliverables}`);

  // FTC Disclosure Clause
  if (opts.ftcDisclosure !== false) {
    parts.push(
      "2. FTC DISCLOSURE COMPLIANCE:\nAthlete shall include clear and conspicuous sponsorship disclosures (e.g., #ad, #sponsored) in compliance with FTC Guides Concerning Endorsements (16 CFR Part 255)."
    );
  }

  // School Marks & IP Clause
  if (opts.schoolMarksProtection !== false) {
    parts.push(
      "3. INSTITUTIONAL IP PROTECTION:\nAthlete shall not display university, school, or conference trademarks, logos, or uniforms in any deliverable without prior written authorization from the institution."
    );
  }

  // Exclusivity
  if (opts.exclusivity && opts.exclusivity !== "non_exclusive") {
    parts.push(
      `4. EXCLUSIVITY SCOPE:\n${EXCLUSIVITY_DESCRIPTIONS[opts.exclusivity]} Duration: ${opts.campaignDurationDays ?? 30} days.`
    );
  }

  // Morals Clause
  if (opts.moralsClause !== false) {
    parts.push(
      "5. MUTUAL MORALS CLAUSE:\nEither party may terminate this agreement if the other engages in conduct resulting in a felony conviction or actions causing material public disrepute."
    );
  }

  // Deliverable Proof & Compensation Release
  if (opts.deliverableProofGate !== false) {
    parts.push(
      "6. PERFORMANCE VERIFICATION:\nPayment shall be disbursed following submission and verification of deliverable proof (screenshot, live URL, or attendance record) on the LIN platform."
    );
  }

  // Minor Guardian Clause
  if (opts.isMinor) {
    parts.push(
      "7. GUARDIAN CONSENT:\nAs the athlete is a minor, this agreement is contingent upon written consent and execution by the athlete's legal parent or guardian."
    );
  }

  // NCAA / Amateurism Safeguard
  parts.push(
    "8. AMATEURISM ATTESTATION:\nCompensation is strictly for fair market value of NIL deliverables and is not an inducement for athletic performance or school enrollment."
  );

  return parts.join("\n\n");
}

export function validateContractLength(terms: string): {
  valid: boolean;
  charCount: number;
  minChars: number;
  maxChars: number;
  error?: string;
} {
  const charCount = terms.trim().length;
  const minChars = 20;
  const maxChars = 2000;

  if (charCount < minChars) {
    return {
      valid: false,
      charCount,
      minChars,
      maxChars,
      error: `Terms too short (${charCount} chars). Minimum ${minChars} required.`,
    };
  }

  if (charCount > maxChars) {
    return {
      valid: false,
      charCount,
      minChars,
      maxChars,
      error: `Terms exceed maximum length (${charCount}/${maxChars} chars). Please condense.`,
    };
  }

  return { valid: true, charCount, minChars, maxChars };
}

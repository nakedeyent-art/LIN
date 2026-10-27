export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "x";

export interface SocialChannelMetrics {
  platform: SocialPlatform;
  handle: string;
  followers: number;
  averageLikes: number;
  averageComments: number;
  averageShares: number;
  averageViews?: number;
}

export interface SocialEngagementReport {
  platform: SocialPlatform;
  engagementRatePercent: number;
  tier: "Nano (<10k)" | "Micro (10k-50k)" | "Mid (50k-250k)" | "Macro (250k+)";
  estimatedFairMarketValuePerPostDollars: number;
  engagementHealth: "exceptional" | "healthy" | "below_average";
}

export interface FtcScanResult {
  status: "COMPLIANT" | "NON_COMPLIANT" | "AMBIGUOUS_RISK";
  score: number; // 0 to 100
  hasExplicitAdTag: boolean;
  hasAmbiguousTag: boolean;
  isBuriedInHashtags: boolean;
  issues: string[];
  recommendations: string[];
  remediatedCaption: string;
}

export function calculateEngagementMetrics(
  metrics: SocialChannelMetrics
): SocialEngagementReport {
  const { followers, averageLikes, averageComments, averageShares, platform } = metrics;
  const safeFollowers = Math.max(1, followers);

  let engagementRatePercent = 0;
  if (platform === "tiktok" && metrics.averageViews && metrics.averageViews > 0) {
    // TikTok industry standard: interactions / views
    engagementRatePercent =
      ((averageLikes + averageComments + averageShares) / metrics.averageViews) * 100;
  } else {
    // Standard follower-based rate
    engagementRatePercent =
      ((averageLikes + averageComments + averageShares) / safeFollowers) * 100;
  }
  engagementRatePercent = Number(engagementRatePercent.toFixed(2));

  // Determine follower tier
  let tier: SocialEngagementReport["tier"] = "Nano (<10k)";
  let baseCpm = 20; // $20 per 1k followers base
  if (followers >= 250000) {
    tier = "Macro (250k+)";
    baseCpm = 35;
  } else if (followers >= 50000) {
    tier = "Mid (50k-250k)";
    baseCpm = 28;
  } else if (followers >= 10000) {
    tier = "Micro (10k-50k)";
    baseCpm = 24;
  }

  // Adjust FMV multiplier based on engagement rate
  let engagementMultiplier = 1.0;
  let engagementHealth: SocialEngagementReport["engagementHealth"] = "healthy";

  if (engagementRatePercent >= 5.0) {
    engagementMultiplier = 1.4;
    engagementHealth = "exceptional";
  } else if (engagementRatePercent < 1.5) {
    engagementMultiplier = 0.7;
    engagementHealth = "below_average";
  }

  const estimatedValue = Math.round(
    (safeFollowers / 1000) * baseCpm * engagementMultiplier
  );

  return {
    platform,
    engagementRatePercent,
    tier,
    estimatedFairMarketValuePerPostDollars: Math.max(50, estimatedValue),
    engagementHealth,
  };
}

export function scanFtcCompliance(
  caption: string,
  sponsorBrand: string
): FtcScanResult {
  const trimmed = caption.trim();
  const lower = trimmed.toLowerCase();
  const brandLower = sponsorBrand.trim().toLowerCase();

  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // 1. Explicit FTC Compliant Tokens
  const explicitTokens = [
    "#ad",
    "#sponsored",
    "sponsored by",
    "paid partnership with",
    `#${brandLower.replace(/[^a-z0-9]/g, "")}partner`,
    `#${brandLower.replace(/[^a-z0-9]/g, "")}ambassador`,
  ];

  const hasExplicitAdTag = explicitTokens.some((tok) => {
    const regex = new RegExp(`(^|\\s)${tok.replace("#", "\\#")}(\\s|$|[,.])`, "i");
    return regex.test(lower);
  });

  // 2. Ambiguous Tokens (FTC specifically cautions against these standalone)
  const ambiguousTokens = ["#collab", "#sp", "#spon", "#partner", "#ambassador", "in partnership with"];
  const hasAmbiguousTag = ambiguousTokens.some((tok) => {
    const regex = new RegExp(`(^|\\s)${tok.replace("#", "\\#")}(\\s|$)`, "i");
    return regex.test(lower);
  });

  // 3. Check for buried hashtags (e.g. #ad after 10 other hashtags or >200 chars down)
  const words = trimmed.split(/\s+/);
  const hashtagCount = words.filter((w) => w.startsWith("#")).length;
  let isBuriedInHashtags = false;

  const adPosition = words.findIndex((w) =>
    w.toLowerCase().includes("#ad") || w.toLowerCase().includes("#sponsored")
  );

  if (adPosition > 8 || (adPosition !== -1 && adPosition > words.length * 0.7 && words.length > 10)) {
    isBuriedInHashtags = true;
  }

  // Scoring logic
  if (!hasExplicitAdTag) {
    if (hasAmbiguousTag) {
      score = 45;
      issues.push(
        "Ambiguous Disclosure: Vague terms like '#collab' or '#partner' without explicit '#ad' fail FTC 16 CFR § 255 endorsement guides."
      );
      recommendations.push(
        `Prepend '#ad' or 'Sponsored by ${sponsorBrand}' clearly at the beginning of the caption.`
      );
    } else {
      score = 10;
      issues.push(
        "Missing Endorsement Disclosure: No conspicuous commercial disclosure was detected in this sponsored post caption."
      );
      recommendations.push(
        `Add '#ad' or 'Paid partnership with ${sponsorBrand}' before the first line break or '...more' truncation.`
      );
    }
  } else if (isBuriedInHashtags) {
    score = 65;
    issues.push(
      "Buried Disclosure Warning: FTC requires disclosures to be unavoidable and conspicuous. '#ad' placed in a cluster of hashtags risks enforcement action."
    );
    recommendations.push(
      "Move '#ad' to the first 3 words of the caption so it is visible before the user clicks 'more'."
    );
  }

  if (hashtagCount > 15) {
    score -= 10;
    issues.push("Hashtag Saturation: Over 15 hashtags detected, reducing readability and FTC conspicuousness.");
  }

  let status: FtcScanResult["status"] = "COMPLIANT";
  if (score < 50) {
    status = "NON_COMPLIANT";
  } else if (score < 80) {
    status = "AMBIGUOUS_RISK";
  }

  // Generate remediated caption
  let remediatedCaption = trimmed;
  if (status !== "COMPLIANT") {
    // Clean out ambiguous tags and prepend conspicuous #ad
    const cleaned = trimmed
      .replace(/#collab\b/gi, "")
      .replace(/#spon\b/gi, "")
      .replace(/#sp\b/gi, "")
      .replace(/#ad\b/gi, "")
      .trim();

    remediatedCaption = `#ad | Sponsored by ${sponsorBrand}\n\n${cleaned}`;
  }

  return {
    status,
    score: Math.max(0, score),
    hasExplicitAdTag,
    hasAmbiguousTag,
    isBuriedInHashtags,
    issues,
    recommendations,
    remediatedCaption,
  };
}

export interface SportRosterCap {
  sportKey: string;
  sportName: string;
  gender: "men" | "women" | "coed";
  hardRosterCap: number; // Post-House settlement maximum
  previousScholarshipLimit: number;
}

export const NCAA_HOUSE_ROSTER_CAPS: SportRosterCap[] = [
  { sportKey: "football", sportName: "Football (FBS)", gender: "men", hardRosterCap: 105, previousScholarshipLimit: 85 },
  { sportKey: "m_basketball", sportName: "Men's Basketball", gender: "men", hardRosterCap: 15, previousScholarshipLimit: 13 },
  { sportKey: "w_basketball", sportName: "Women's Basketball", gender: "women", hardRosterCap: 15, previousScholarshipLimit: 15 },
  { sportKey: "baseball", sportName: "Baseball", gender: "men", hardRosterCap: 34, previousScholarshipLimit: 11.7 },
  { sportKey: "softball", sportName: "Softball", gender: "women", hardRosterCap: 25, previousScholarshipLimit: 12 },
  { sportKey: "w_volleyball", sportName: "Women's Volleyball", gender: "women", hardRosterCap: 18, previousScholarshipLimit: 12 },
  { sportKey: "m_soccer", sportName: "Men's Soccer", gender: "men", hardRosterCap: 28, previousScholarshipLimit: 9.9 },
  { sportKey: "w_soccer", sportName: "Women's Soccer", gender: "women", hardRosterCap: 28, previousScholarshipLimit: 14 },
  { sportKey: "m_track", sportName: "Men's Track & Field / XC", gender: "men", hardRosterCap: 45, previousScholarshipLimit: 12.6 },
  { sportKey: "w_track", sportName: "Women's Track & Field / XC", gender: "women", hardRosterCap: 45, previousScholarshipLimit: 18 },
];

export const ANNUAL_REV_SHARE_CAP_2026 = 22000000; // $22.0M cap for 2025-2026 academic year

export interface SportAllocationInput {
  sportKey: string;
  currentRosterCount: number;
  allocatedRevShareDollars: number;
}

export interface TitleIxAuditResult {
  menTotalRevShareDollars: number;
  womenTotalRevShareDollars: number;
  totalAllocatedDollars: number;
  capUtilizationPercent: number;
  isOverCap: boolean;
  menSharePercent: number;
  womenSharePercent: number;
  underrepresentedGender: "women" | "men" | "balanced";
  titleIxDisparityAlert: boolean;
  notes: string[];
}

export interface RosterCapValidationResult {
  sportKey: string;
  sportName: string;
  currentCount: number;
  maxCap: number;
  isExceeded: boolean;
  availableSpots: number;
}

export interface AthleteStipendSchedule {
  athleteId: string;
  athleteName: string;
  sportName: string;
  annualRevShareAmount: number;
  disbursementFrequency: "monthly_10" | "monthly_12";
  monthlyDisbursementAmount: number;
  installments: Array<{
    installmentIndex: number;
    disbursementDate: string;
    amountDollars: number;
    status: "SCHEDULED" | "PROCESSING" | "PAID";
  }>;
}

export function validateRosterCaps(
  allocations: SportAllocationInput[]
): RosterCapValidationResult[] {
  return allocations.map((alloc) => {
    const config = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === alloc.sportKey);
    const maxCap = config ? config.hardRosterCap : 100;
    const sportName = config ? config.sportName : alloc.sportKey;
    const isExceeded = alloc.currentRosterCount > maxCap;

    return {
      sportKey: alloc.sportKey,
      sportName,
      currentCount: alloc.currentRosterCount,
      maxCap,
      isExceeded,
      availableSpots: Math.max(0, maxCap - alloc.currentRosterCount),
    };
  });
}

export function evaluateTitleIxAndRevShareCap(
  allocations: SportAllocationInput[],
  maxCapDollars: number = ANNUAL_REV_SHARE_CAP_2026,
  undergradFemaleRatioTarget: number = 0.50
): TitleIxAuditResult {
  let menTotal = 0;
  let womenTotal = 0;

  for (const alloc of allocations) {
    const config = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === alloc.sportKey);
    const gender = config ? config.gender : "men";
    if (gender === "women") {
      womenTotal += alloc.allocatedRevShareDollars;
    } else {
      menTotal += alloc.allocatedRevShareDollars;
    }
  }

  const totalAllocated = menTotal + womenTotal;
  const capUtilizationPercent = totalAllocated > 0 ? (totalAllocated / maxCapDollars) * 100 : 0;
  const isOverCap = totalAllocated > maxCapDollars;

  const menSharePercent = totalAllocated > 0 ? (menTotal / totalAllocated) * 100 : 50;
  const womenSharePercent = totalAllocated > 0 ? (womenTotal / totalAllocated) * 100 : 50;

  const notes: string[] = [];

  if (isOverCap) {
    notes.push(
      `Cap Exceeded: Allocated $${totalAllocated.toLocaleString()} exceeds the federal court-approved $${maxCapDollars.toLocaleString()} ceiling.`
    );
  }

  // Title IX check: If female funding is > 10% below target ratio, flag advisory
  const targetWomenPercent = undergradFemaleRatioTarget * 100;
  const titleIxDisparityAlert = womenSharePercent < targetWomenPercent - 15;

  let underrepresentedGender: "women" | "men" | "balanced" = "balanced";
  if (womenSharePercent < targetWomenPercent - 5) {
    underrepresentedGender = "women";
    notes.push(
      `Title IX Advisory: Women's sports receive ${womenSharePercent.toFixed(1)}% of direct revenue-sharing funds vs. an undergraduate target of ${targetWomenPercent}%. Ensure non-rev share scholarship equity offsets this gap.`
    );
  } else if (menSharePercent < 40) {
    underrepresentedGender = "men";
  }

  return {
    menTotalRevShareDollars: menTotal,
    womenTotalRevShareDollars: womenTotal,
    totalAllocatedDollars: totalAllocated,
    capUtilizationPercent: Number(capUtilizationPercent.toFixed(1)),
    isOverCap,
    menSharePercent: Number(menSharePercent.toFixed(1)),
    womenSharePercent: Number(womenSharePercent.toFixed(1)),
    underrepresentedGender,
    titleIxDisparityAlert,
    notes,
  };
}

export function generateAthleteStipendSchedule(
  athleteId: string,
  athleteName: string,
  sportKey: string,
  annualRevShareAmount: number,
  frequency: "monthly_10" | "monthly_12" = "monthly_12",
  academicYearStart: string = "2026-08-01"
): AthleteStipendSchedule {
  const sportConfig = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === sportKey);
  const sportName = sportConfig ? sportConfig.sportName : sportKey;

  const totalPayments = frequency === "monthly_10" ? 10 : 12;
  const baseMonthly = Math.floor(annualRevShareAmount / totalPayments);
  const remainder = annualRevShareAmount - baseMonthly * totalPayments;

  const startDate = new Date(academicYearStart);
  const installments = [];

  for (let i = 0; i < totalPayments; i++) {
    const payDate = new Date(startDate);
    payDate.setMonth(startDate.getMonth() + i);
    const amount = i === totalPayments - 1 ? baseMonthly + remainder : baseMonthly;

    installments.push({
      installmentIndex: i + 1,
      disbursementDate: payDate.toISOString().split("T")[0],
      amountDollars: amount,
      status: "SCHEDULED" as const,
    });
  }

  return {
    athleteId,
    athleteName,
    sportName,
    annualRevShareAmount,
    disbursementFrequency: frequency,
    monthlyDisbursementAmount: baseMonthly,
    installments,
  };
}

/**
 * Athletic Daily Readiness, Wellness Tracking, and Recovery Protocols.
 * Algorithmic calculation based on sleep duration/quality, delayed onset muscle soreness (DOMS),
 * perceived stress, and training motivation.
 */

export type ReadinessLog = {
  sleepHours: number;
  sleepQuality: number; // 1-5 scale
  muscleSoreness: number; // 1-5 scale (1 = completely fresh, 5 = severe soreness)
  mentalStress: number; // 1-5 scale (1 = calm/grounded, 5 = high anxiety/stress)
  motivation: number; // 1-5 scale (1 = sluggish/burnt out, 5 = locked in/hyped)
  notes?: string;
};

export type ReadinessStatus = {
  score: number; // 0 - 100
  label: "Optimal / Game Ready" | "Moderate / Normal" | "Fatigued / High Stress";
  color: string;
  tone: "green" | "blue" | "yellow";
  advice: string;
};

/**
 * Calculates a 0-100% readiness score:
 * - Sleep hours (up to 8h): 25 pts
 * - Sleep quality (1-5): 20 pts
 * - Inverted soreness (1-5): 20 pts
 * - Inverted stress (1-5): 20 pts
 * - Motivation (1-5): 15 pts
 */
export function calculateReadinessScore(log: ReadinessLog): number {
  const hours = Math.max(0, Math.min(14, log.sleepHours));
  const quality = Math.max(1, Math.min(5, log.sleepQuality));
  const soreness = Math.max(1, Math.min(5, log.muscleSoreness));
  const stress = Math.max(1, Math.min(5, log.mentalStress));
  const motivation = Math.max(1, Math.min(5, log.motivation));

  const sleepPts = Math.min(25, (hours / 8) * 25);
  const qualityPts = (quality / 5) * 20;
  const sorenessPts = ((6 - soreness) / 5) * 20;
  const stressPts = ((6 - stress) / 5) * 20;
  const motivationPts = (motivation / 5) * 15;

  return Math.min(100, Math.max(0, Math.round(sleepPts + qualityPts + sorenessPts + stressPts + motivationPts)));
}

export function getReadinessStatus(score: number): ReadinessStatus {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 80) {
    return {
      score: clamped,
      label: "Optimal / Game Ready",
      color: "var(--ok)",
      tone: "green",
      advice: "Prime physiological and mental state. Full training intensity authorized.",
    };
  }
  if (clamped >= 60) {
    return {
      score: clamped,
      label: "Moderate / Normal",
      color: "#2563eb",
      tone: "blue",
      advice: "Adequate readiness. Maintain standard workout volume and ensure post-training hydration.",
    };
  }
  return {
    score: clamped,
    label: "Fatigued / High Stress",
    color: "var(--needs)",
    tone: "yellow",
    advice: "Intervention recommended: consider active recovery, mobility, and reducing high-impact load.",
  };
}

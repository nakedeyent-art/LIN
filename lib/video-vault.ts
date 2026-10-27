/**
 * Film & Video Highlight Vault Engine
 * Pure domain logic for athlete video reels, timestamped skill clips,
 * recruiter evaluations, and shareable prospect links.
 */

export type SkillCategory =
  | "All Skills"
  | "Shooting & Shot Creation"
  | "Playmaking & Passing"
  | "On-Ball Defense"
  | "Rim Protection & Rebounding"
  | "Athleticism & Transition"
  | "Basketball IQ & Read";

export type VideoClip = {
  id: string;
  timestamp: string; // e.g. "01:24"
  seconds: number;
  title: string;
  skillCategory: SkillCategory;
  description: string;
  rating?: number; // 1-5 stars
};

export type HighlightReel = {
  id: string;
  athleteId: string;
  athleteName: string;
  sport: string;
  title: string;
  gameOrEvent: string;
  videoUrl: string;
  durationSeconds: number;
  recordedDate: string;
  verifiedGameFilm: boolean;
  clips: VideoClip[];
};

export function formatTimestamp(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(ts, 10) || 0;
}

export function filterClipsBySkill(clips: VideoClip[], skill?: string): VideoClip[] {
  if (!skill || skill === "All Skills") return clips;
  return clips.filter((c) => c.skillCategory === skill);
}

export function generateRecruiterShareToken(athleteId: string, reelId: string, expiresInDays = 30): string {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  // Compact, URL-safe prospect verification payload
  const payload = `${athleteId.slice(0, 8)}:${reelId.slice(0, 8)}:${expiresAt}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `nil_film_${encoded}`;
}

export function isShareTokenValid(token: string): boolean {
  if (!token.startsWith("nil_film_")) return false;
  try {
    const raw = Buffer.from(token.replace("nil_film_", ""), "base64url").toString("utf-8");
    const parts = raw.split(":");
    if (parts.length !== 3) return false;
    const expiresAt = parseInt(parts[2], 10);
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

export function createVideoClip(input: {
  timestamp: string;
  title: string;
  skillCategory: SkillCategory;
  description: string;
  rating?: number;
}): VideoClip {
  const seconds = parseTimestamp(input.timestamp);
  const formattedTs = formatTimestamp(seconds);
  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: formattedTs,
    seconds,
    title: input.title.trim() || "Untagged Sequence",
    skillCategory: input.skillCategory,
    description: input.description.trim(),
    rating: input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : 3,
  };
}


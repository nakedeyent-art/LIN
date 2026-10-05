import type { Course } from "./calc";

export type GradeLog = { course: string; grade: number; at: Date };
export type StudyRow = { minutes: number; studiedOn: string; verified: boolean };

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

/** Latest grade per course (case-insensitive) plus the one before it, for trend/alerts. */
export function courseTrends(logs: GradeLog[]): Course[] {
  const byCourse = new Map<string, GradeLog[]>();
  for (const l of logs) {
    const k = norm(l.course).toLowerCase();
    byCourse.set(k, [...(byCourse.get(k) ?? []), l]);
  }
  return [...byCourse.values()]
    .map((ls) => ls.sort((a, b) => b.at.getTime() - a.at.getTime()))
    .map((ls) => ({ name: norm(ls[0].course), grade: ls[0].grade, previousGrade: ls[1]?.grade }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const avgGrade = (cs: Course[]): number | null =>
  cs.length ? Math.round((cs.reduce((t, c) => t + c.grade, 0) / cs.length) * 10) / 10 : null;

const dayNum = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);

/** Study minutes in the 7 days ending `today` (inclusive). `verified` counts only guardian/manager-verified time. */
export function weeklyStudy(rows: StudyRow[], today: string): { total: number; verified: number } {
  let total = 0, verified = 0;
  for (const r of rows) {
    const age = dayNum(today) - dayNum(r.studiedOn);
    if (age < 0 || age > 6) continue;
    total += r.minutes;
    if (r.verified) verified += r.minutes;
  }
  return { total, verified };
}

export const todayStr = (now = new Date()) => now.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);

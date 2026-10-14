/**
 * Event times belong to the place the event happens. Forms take a wall-clock time plus the venue's IANA time zone, we store the exact
 * instant (timestamptz) and the zone, and every reader sees the venue time first with the option of their own.
 */
const supported = new Set<string>((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC']);

export const isValidTimeZone = (tz: string): boolean => {
  if (supported.has(tz)) return true;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};

/** Zones offered in forms: the viewer's own first, then US zones, then everything else alphabetically. */
export function timeZoneChoices(first?: string): string[] {
  const us = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'UTC'];
  const rest = [...supported].filter((z) => !us.includes(z)).sort();
  const all = [...us, ...rest];
  return first && isValidTimeZone(first) ? [first, ...all.filter((z) => z !== first)] : all;
}

const parts = (d: Date, tz: string) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second);
};

/** Milliseconds since the epoch for a wall-clock time ("2027-01-10T15:00") in a zone. Returns NaN for bad input. Nonexistent (spring-forward) times resolve forward. */
export function zonedToUtc(local: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m || !isValidTimeZone(tz)) return NaN;
  const [y, mo, d, h, mi, se] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return NaN;
  const wall = Date.UTC(y, mo - 1, d, h, mi, se);
  if (!Number.isFinite(wall) || new Date(wall).getUTCMonth() !== mo - 1) return NaN;   // e.g. Feb 30 rolled over
  // Two passes handle DST: the offset at the guessed instant, then the offset at the corrected one.
  const guess = wall - (parts(new Date(wall), tz) - wall);
  const refined = wall - (parts(new Date(guess), tz) - guess);
  return parts(new Date(refined), tz) === wall ? refined : guess;   // a wall time that does not exist (spring forward) resolves forward
}

/** The wall-clock value ("2027-01-10T15:00") of an instant in a zone, for datetime-local inputs. */
export function utcToZoned(at: Date | string, tz: string): string {
  const d = new Date(at);
  return new Date(parts(d, isValidTimeZone(tz) ? tz : 'UTC')).toISOString().slice(0, 16);
}

/** "Sat, Jan 10, 2027, 3:00 PM EST" style display of an instant in a zone. */
export function formatInZone(at: Date | string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: isValidTimeZone(tz) ? tz : 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(at));
}

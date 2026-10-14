import { describe, it, expect } from 'vitest';
import { zonedToUtc, utcToZoned, formatInZone, isValidTimeZone, timeZoneChoices } from './timezones';

describe('event time zones', () => {
  it('converts a venue wall-clock time to the exact instant, including across DST', () => {
    expect(new Date(zonedToUtc('2027-01-10T15:00', 'America/New_York')).toISOString()).toBe('2027-01-10T20:00:00.000Z');   // EST
    expect(new Date(zonedToUtc('2027-07-10T15:00', 'America/New_York')).toISOString()).toBe('2027-07-10T19:00:00.000Z');   // EDT
    expect(new Date(zonedToUtc('2027-07-10T15:00', 'UTC')).toISOString()).toBe('2027-07-10T15:00:00.000Z');
    expect(new Date(zonedToUtc('2027-03-14T02:30', 'America/New_York')).toISOString()).toBe('2027-03-14T07:30:00.000Z');   // nonexistent local time resolves forward
  });
  it('round-trips through datetime-local values and rejects junk', () => {
    const at = zonedToUtc('2027-11-07T01:30', 'America/Chicago');
    expect(utcToZoned(new Date(at), 'America/Chicago')).toBe('2027-11-07T01:30');
    for (const bad of ['soon', '2027-13-01T10:00', '2027-01-01']) expect(zonedToUtc(bad, 'UTC')).toBeNaN();
    expect(zonedToUtc('2027-01-01T10:00', 'Mars/Olympus')).toBeNaN();
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Nowhere')).toBe(false);
  });
  it('formats in the venue zone and puts the viewer’s zone first in the choices', () => {
    expect(formatInZone('2027-01-10T20:00:00Z', 'America/New_York')).toMatch(/Jan 10, 2027.*3:00 PM EST/);
    const c = timeZoneChoices('Europe/Paris');
    expect(c[0]).toBe('Europe/Paris');
    expect(c.filter((z) => z === 'Europe/Paris').length).toBe(1);
    expect(c).toContain('America/Los_Angeles');
  });
});

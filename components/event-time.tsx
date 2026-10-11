"use client";
import { useState } from 'react';

const fmt = (at: string, tz: string) => {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(at)); }
  catch { return new Date(at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
};

/**
 * An event's time in the venue's zone, with a button that shows the same instant in the viewer's own zone (read from the browser).
 * The venue time is the default because that is when the athlete must be there.
 */
export function EventTime({ startsAt, endsAt, timezone }: { startsAt: string; endsAt: string; timezone: string }) {
  const [local, setLocal] = useState(false);
  const mine = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  const tz = local ? mine : timezone, same = mine === timezone;
  return <span className="event-time">
    <span>{fmt(startsAt, tz)}</span><br /><span>to {fmt(endsAt, tz)}</span>
    {!same && <><br /><button type="button" className="btn ghost small" aria-pressed={local} onClick={() => setLocal((v) => !v)}>{local ? `Show venue time (${timezone})` : 'Show in my time zone'}</button></>}
  </span>;
}

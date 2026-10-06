export const DELETE_PHRASE = "DELETE";

/** a***@example.com — enough for the owner to recognise an address in a notice, not enough to harvest it. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local[0] ?? ""}${"*".repeat(Math.max(1, Math.min(local.length - 1, 5)))}@${domain}`;
}

export function validateDisplayName(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2 || n.length > 80) return "Name must be 2–80 characters.";
  if (/[\u0000-\u001f\u007f<>]/.test(n)) return "Name contains characters that aren't allowed.";
  return null;
}

export type AthleteProfileInput = { sport: string; position: string; state: string; gradYear: string };
export type AthleteProfile = { sport: string; position: string | null; state: string | null; gradYear: number | null };

export function validateAthleteProfile(i: AthleteProfileInput): { ok: true; value: AthleteProfile } | { ok: false; error: string } {
  const sport = i.sport.trim(), position = i.position.trim(), state = i.state.trim().toUpperCase(), gy = i.gradYear.trim();
  if (sport.length < 2 || sport.length > 50) return { ok: false, error: "Sport must be 2–50 characters." };
  if (position.length > 50) return { ok: false, error: "Position is too long." };
  if (state && !/^[A-Z]{2}$/.test(state)) return { ok: false, error: "State must be a 2-letter code (e.g. TX)." };
  let gradYear: number | null = null;
  if (gy) {
    if (!/^\d{4}$/.test(gy) || +gy < 2000 || +gy > 2100) return { ok: false, error: "Graduation year must be between 2000 and 2100." };
    gradYear = +gy;
  }
  return { ok: true, value: { sport, position: position || null, state: state || null, gradYear } };
}

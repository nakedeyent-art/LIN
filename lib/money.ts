export const MAX_FEE_BPS = 2000;   // hard ceiling: 20%

/** Platform fee in cents, rounded DOWN so the platform never takes more than the stated percentage. */
export function platformFee(amountCents: number, bps: number): number {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("amount must be a positive integer of cents");
  if (!Number.isInteger(bps) || bps < 0 || bps > MAX_FEE_BPS) throw new Error(`fee must be 0–${MAX_FEE_BPS} basis points`);
  return Math.floor((amountCents * bps) / 10000);
}

export const payoutCents = (amountCents: number, bps: number) => amountCents - platformFee(amountCents, bps);

/** Reads PLATFORM_FEE_BPS; invalid or missing values mean 0 (no fee) rather than an accidental charge. */
export function feeBpsFromEnv(raw: string | undefined): number {
  if (!raw || !/^\d{1,4}$/.test(raw.trim())) return 0;
  const n = parseInt(raw, 10);
  return n >= 0 && n <= MAX_FEE_BPS ? n : 0;
}

export const formatBps = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

/** Parses a plain decimal string within [min, max] with at most `decimals` places; null if invalid. */
export function parseBounded(s: string, min: number, max: number, decimals = 0): number | null {
  const re = decimals > 0 ? new RegExp(`^\\d{1,6}(\\.\\d{1,${decimals}})?$`) : /^\d{1,6}$/;
  if (!re.test(s)) return null;
  const n = parseFloat(s);
  return n >= min && n <= max ? n : null;
}

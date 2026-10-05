export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200; // bounds scrypt work per request

/** Returns an error message, or null if the password is acceptable. Shared by signup and reset. */
export function validateNewPassword(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (email && (lower === email.toLowerCase() || lower === email.toLowerCase().split("@")[0])) return "Password can't be your email.";
  if (/^(.)\1+$/.test(password)) return "Choose a less repetitive password.";
  if (["password12", "1234567890", "qwertyuiop", "password123", "letmein123"].some((w) => lower.startsWith(w))) return "That password is too common.";
  return null;
}

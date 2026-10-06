"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  ageFromBirthDate, hashPassword, isValidEmail, normalizeEmail, verifyPassword,
} from "@/lib/crypto";
import { createSession, destroySession } from "@/lib/session";
import { isRole } from "@/lib/roles";
import { safeNext } from "@/lib/redirect";
import { validateNewPassword } from "@/lib/password-policy";
import { clearFailures, recordFailure } from "@/lib/lockout";
import { sendGuardianInvite, sendVerificationEmail } from "@/lib/verification";

// Verified against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const failWithNext = (path: string, msg: string, next?: string): never =>
  redirect(`${path}?error=${encodeURIComponent(msg)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

export async function login(formData: FormData) {
  const next = safeNext(str(formData, "next"));
  const email = normalizeEmail(str(formData, "email"));
  const password = String(formData.get("password") ?? "");
  const { rows } = await db().query(
    "SELECT id, password_hash, failed_logins, locked_until FROM users WHERE email = $1 AND deleted_at IS NULL", [email]);
  const u = rows[0];
  const locked = u?.locked_until && new Date(u.locked_until) > new Date();
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || locked || !ok) {
    if (u && !locked) await recordFailure(u.id);
    failWithNext("/login", locked ? "Too many attempts. Try again in 15 minutes." : "Invalid email or password.", next);
  }
  await clearFailures(u.id);
  await createSession(u.id);
  redirect(next);
}

export async function signup(formData: FormData) {
  const P = "/signup";
  const next = safeNext(str(formData, "next"));
  const fail = (path: string, msg: string): never => failWithNext(path, msg, next);
  const email = normalizeEmail(str(formData, "email"));
  const name = str(formData, "name").slice(0, 80);
  const role = str(formData, "role");
  const password = String(formData.get("password") ?? "");
  if (!name) fail(P, "Name is required.");
  if (!isValidEmail(email)) fail(P, "Enter a valid email.");
  const pwError = validateNewPassword(password, email);
  if (pwError) fail(P, pwError);
  if (!isRole(role)) fail(P, "Choose a role.");

  const sport = str(formData, "sport");
  const position = str(formData, "position");
  const birth = str(formData, "birth_date");
  const guardianEmail = normalizeEmail(str(formData, "guardian_email"));
  const declared = str(formData, "declared_role");
  let age: number | null = null;

  if (role === "athlete") {
    age = ageFromBirthDate(birth);
    if (age === null || age < 5 || age > 100) fail(P, "Enter a valid birth date.");
    if (!sport) fail(P, "Sport is required for athletes.");
    if ((age as number) < 18 && !isValidEmail(guardianEmail)) fail(P, "Athletes under 18 need a parent/guardian email.");
  }
  const credential = str(formData, "credential_type").slice(0, 80);
  if (role === "manager" && !["marketing_agent", "certified_strength_coach", "mentor"].includes(declared)) {
    fail(P, "Managers must declare their professional role.");
  }
  if (role === "manager" && declared === "certified_strength_coach" && !credential) fail(P, "Enter your certification (e.g. CSCS).");
  if (role === "trainer" && !credential) fail(P, "Trainers must enter their certification (e.g. CSCS, NASM).");

  const hash = await hashPassword(password);
  const client = await db().connect();
  let userId: string;
  let inviteId: string | null = null;
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      "INSERT INTO users(email, full_name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id",
      [email, name, role, hash]);
    userId = ins.rows[0].id;
    if (role === "athlete") {
      await client.query(
        "INSERT INTO athlete_profiles(user_id, sport, position, level, birth_date) VALUES ($1,$2,$3,$4,$5)",
        [userId, sport, position || null, (age as number) < 18 ? "high_school" : "college", birth]);
      if ((age as number) < 18) {
        inviteId = (await client.query("INSERT INTO guardian_invites(athlete_id, guardian_email) VALUES ($1,$2) RETURNING id", [userId, guardianEmail])).rows[0].id;
      }
    }
    // Managers and trainers both declare their professional capacity. Credentials are self-declared (unverified).
    if (role === "manager" || role === "trainer") {
      await client.query("INSERT INTO manager_declarations(manager_id, declared_role, credential_type) VALUES ($1,$2,$3)",
        [userId, role === "trainer" ? "certified_strength_coach" : declared, credential || null]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505") fail(P, "An account with that email already exists.");
    throw e;
  } finally {
    client.release();
  }
  await createSession(userId);
  // Mail failures must not block signup; both can be re-sent from the app.
  try { await sendVerificationEmail(userId, true); } catch (e) { console.error("verification email failed", e); }
  if (inviteId) { try { await sendGuardianInvite(inviteId); } catch (e) { console.error("guardian invite failed", e); } }
  redirect("/verify-email" + (next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { subjectFor } from "@/lib/access";
import { addDays, daysBetween, todayStr } from "@/lib/academics";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const back = (athlete: string | null, key: "msg" | "error", m: string): never =>
  redirect(`/dashboard/academics?${athlete ? `athlete=${athlete}&` : ""}${key}=${encodeURIComponent(m)}`);

async function athleteOnly() {
  const s = await requireAccess("/dashboard/academics");
  if (s.role !== "athlete") redirect("/dashboard/academics");
  return s;
}

export async function addGrade(formData: FormData) {
  const s = await athleteOnly();
  const course = str(formData, "course").replace(/\s+/g, " ");
  const raw = str(formData, "grade");
  if (course.length < 2 || course.length > 60) back(null, "error", "Course name must be 2–60 characters.");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw) || parseFloat(raw) > 100) back(null, "error", "Enter a grade between 0 and 100.");
  await db().query("INSERT INTO academic_logs(athlete_id, course_name, current_grade) VALUES ($1,$2,$3)", [s.userId, course, raw]);
  back(null, "msg", "Grade saved.");
}

export async function deleteGrade(formData: FormData) {
  const s = await athleteOnly();
  const id = str(formData, "id");
  if (UUID.test(id)) await db().query("DELETE FROM academic_logs WHERE id=$1 AND athlete_id=$2", [id, s.userId]);
  back(null, "msg", "Entry removed.");
}

export async function logStudy(formData: FormData) {
  const s = await athleteOnly();
  const minutes = /^\d{1,3}$/.test(str(formData, "minutes")) ? parseInt(str(formData, "minutes"), 10) : NaN;
  const subject = str(formData, "subject");
  const note = str(formData, "note").slice(0, 300);
  const day = str(formData, "studied_on") || todayStr();
  const today = todayStr();
  if (!(minutes >= 5 && minutes <= 480)) back(null, "error", "Study time must be 5–480 minutes.");
  if (subject.length < 2 || subject.length > 60) back(null, "error", "Enter the subject (2–60 characters).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(day, today) < 0 || daysBetween(day, today) > 7) back(null, "error", "Date must be within the last 7 days.");
  await db().query("INSERT INTO study_sessions(athlete_id, minutes, subject, note, studied_on) VALUES ($1,$2,$3,$4,$5)", [s.userId, minutes, subject, note || null, day]);
  back(null, "msg", "Study session logged. A parent/guardian or manager can verify it.");
}

export async function deleteStudy(formData: FormData) {
  const s = await athleteOnly();
  const id = str(formData, "id");
  if (UUID.test(id)) await db().query("DELETE FROM study_sessions WHERE id=$1 AND athlete_id=$2 AND verified_at IS NULL", [id, s.userId]);
  back(null, "msg", "Session removed.");
}

/** Proof of study: only a linked guardian or a manager with academics access can verify — never the athlete. */
export async function verifyStudy(formData: FormData) {
  const s = await requireAccess("/dashboard/academics");
  const id = str(formData, "id");
  if (!UUID.test(id)) redirect("/dashboard/academics");
  const row = (await db().query("SELECT athlete_id FROM study_sessions WHERE id=$1", [id])).rows[0];
  const subject = row ? await subjectFor(s, row.athlete_id) : null;
  if (!subject || !subject.academics || !(subject.guardianPowers || subject.relationship === "manager")) back(null, "error", "You can't verify this session.");
  await db().query("UPDATE study_sessions SET verified_by=$2, verified_at=NOW() WHERE id=$1 AND verified_at IS NULL", [id, s.userId]);
  back(subject!.id, "msg", "Verified.");
}

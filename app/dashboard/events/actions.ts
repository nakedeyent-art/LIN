"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { daysBetween, todayStr } from "@/lib/academics";
import { EVENT_STATUSES } from "@/lib/events";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (key: "msg" | "error", m: string): never => redirect(`/dashboard/events?${key}=${encodeURIComponent(m)}`);

export async function createEvent(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const name = str(formData, "name"), sport = str(formData, "sport"), loc = str(formData, "location"), date = str(formData, "starts_on");
  if (name.length < 3 || name.length > 100) done("error", "Name must be 3–100 characters.");
  if (sport.length < 2 || sport.length > 50) done("error", "Enter the sport.");
  if (loc.length > 100) done("error", "Location is too long.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || daysBetween(todayStr(), date) < 0) done("error", "Pick a start date that isn't in the past.");
  await db().query("INSERT INTO events(organizer_id, name, sport, starts_on, location, status) VALUES ($1,$2,$3,$4,$5,'draft')", [s.userId, name, sport, date, loc || null]);
  done("msg", "Event created as a draft.");
}

export async function setEventStatus(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const id = str(formData, "id"), status = str(formData, "status");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(EVENT_STATUSES as readonly string[]).includes(status)) done("error", "Invalid request.");
  await db().query("UPDATE events SET status=$3 WHERE id=$1 AND organizer_id=$2", [id, s.userId, status]);
  done("msg", "Event updated.");
}

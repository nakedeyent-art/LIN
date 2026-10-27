"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { daysBetween, todayStr } from "@/lib/academics";
import { EVENT_STATUSES } from "@/lib/events";
import {
  createOrResetTournamentBracket,
  recordMatchScoreInDb,
  deleteTournamentBracket,
  type TeamInput,
} from "@/lib/tournament-brackets";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (key: "msg" | "error", m: string, eventId?: string): never => {
  const q = new URLSearchParams({ [key]: m });
  if (eventId) q.set("event", eventId);
  redirect(`/dashboard/events?${q.toString()}`);
};

export async function createEvent(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const name = str(formData, "name"), sport = str(formData, "sport"), loc = str(formData, "location"), date = str(formData, "starts_on");
  if (name.length < 3 || name.length > 100) done("error", "Name must be 3–100 characters.");
  if (sport.length < 2 || sport.length > 50) done("error", "Enter the sport.");
  if (loc.length > 100) done("error", "Location is too long.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || daysBetween(todayStr(), date) < 0) done("error", "Pick a start date that isn't in the past.");
  const res = await db().query(
    "INSERT INTO events(organizer_id, name, sport, starts_on, location, status) VALUES ($1,$2,$3,$4,$5,'published') RETURNING id",
    [s.userId, name, sport, date, loc || null]
  );
  const newId = res.rows[0]?.id as string;
  done("msg", "Event created successfully.", newId);
}

export async function setEventStatus(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const id = str(formData, "id"), status = str(formData, "status");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(EVENT_STATUSES as readonly string[]).includes(status)) done("error", "Invalid request.");
  await db().query("UPDATE events SET status=$3 WHERE id=$1 AND organizer_id=$2", [id, s.userId, status]);
  done("msg", "Event updated.", id);
}

export async function createOrResetBracketAction(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const eventId = str(formData, "event_id");
  const format = str(formData, "format") as "single_elimination" | "double_elimination";
  const teamsRaw = str(formData, "teams_json");

  if (!["single_elimination", "double_elimination"].includes(format)) {
    done("error", "Please select a valid tournament format.", eventId);
  }

  let teams: TeamInput[] = [];
  try {
    if (teamsRaw) {
      teams = JSON.parse(teamsRaw) as TeamInput[];
    } else {
      // Fallback to text lines: one team name per line
      const lines = str(formData, "teams_text")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      teams = lines.map((name, idx) => ({
        name,
        seed: idx + 1,
      }));
    }
  } catch {
    done("error", "Invalid teams payload. Provide valid team names.", eventId);
  }

  const res = await createOrResetTournamentBracket(s, eventId, format, teams);
  if (!res.ok) {
    return done("error", res.error, eventId);
  }

  return done("msg", res.message || "Tournament bracket generated.", eventId);
}

export async function recordScoreAction(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const eventId = str(formData, "event_id");
  const matchKey = str(formData, "match_key");
  const scoreA = parseInt(str(formData, "score_a"), 10);
  const scoreB = parseInt(str(formData, "score_b"), 10);
  const isFinal = formData.get("is_final") === "true" || formData.get("is_final") === "on";

  const res = await recordMatchScoreInDb(s, eventId, matchKey, scoreA, scoreB, isFinal);
  if (!res.ok) {
    return done("error", res.error, eventId);
  }

  return done("msg", res.message || "Score recorded.", eventId);
}

export async function deleteBracketAction(formData: FormData) {
  const s = await requireAccess("/dashboard/events");
  const eventId = str(formData, "event_id");

  const res = await deleteTournamentBracket(s, eventId);
  if (!res.ok) {
    return done("error", res.error, eventId);
  }

  return done("msg", res.message || "Bracket removed.", eventId);
}

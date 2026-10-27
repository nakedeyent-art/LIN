import type { PoolClient } from "pg";
import { db } from "./db";
import { validId } from "./operations";
import {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  updateMatchScore as advanceMatchScore,
  type TournamentBracket,
  type Team,
  type Match,
  type TournamentRound,
} from "./brackets";

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export type TeamInput = {
  name: string;
  seed: number;
  city?: string;
  record?: string;
  coach?: string;
};

export function validateTeamInputs(teamInputs: TeamInput[]): { valid: true } | { valid: false; error: string } {
  if (!Array.isArray(teamInputs) || teamInputs.length < 2 || teamInputs.length > 32) {
    return { valid: false, error: "Bracket requires between 2 and 32 participating teams." };
  }
  const seeds = new Set<number>();
  for (const t of teamInputs) {
    const trimmed = (t.name || "").trim();
    if (trimmed.length < 2 || trimmed.length > 120) {
      return { valid: false, error: "Team names must be between 2 and 120 characters." };
    }
    if (!Number.isInteger(t.seed) || t.seed < 1 || t.seed > teamInputs.length) {
      return { valid: false, error: `Team seed must be an integer between 1 and ${teamInputs.length}.` };
    }
    if (seeds.has(t.seed)) {
      return { valid: false, error: `Duplicate seed #${t.seed} detected.` };
    }
    seeds.add(t.seed);
  }
  return { valid: true };
}

export function validateScoreInputs(
  scoreA: number,
  scoreB: number,
  isFinal: boolean
): { valid: true } | { valid: false; error: string } {
  if (!Number.isInteger(scoreA) || scoreA < 0 || scoreA > 999) {
    return { valid: false, error: "Score A must be between 0 and 999." };
  }
  if (!Number.isInteger(scoreB) || scoreB < 0 || scoreB > 999) {
    return { valid: false, error: "Score B must be between 0 and 999." };
  }
  if (isFinal && scoreA === scoreB) {
    return { valid: false, error: "Ties are not allowed for final tournament games." };
  }
  return { valid: true };
}

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Check if the actor is authorized to manage brackets for an event (organizer or admin) */
export async function canManageEventBracket(
  c: PoolClient | ReturnType<typeof db>,
  userId: string,
  role: string,
  eventId: string
): Promise<boolean> {
  if (role === "admin") return true;
  const res = await c.query(
    "SELECT 1 FROM events e JOIN users u ON u.id = e.organizer_id WHERE e.id = $1 AND e.organizer_id = $2 AND u.deleted_at IS NULL AND u.suspended_at IS NULL",
    [eventId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Loads a real tournament bracket by its linked eventId.
 * Reconstructs the complete TournamentBracket structure including teams, rounds, and matches.
 */
export async function getTournamentBracketByEventId(eventId: string): Promise<TournamentBracket | null> {
  if (!validId(eventId)) return null;

  const bracketRow = (
    await db().query(
      "SELECT id, event_id, name, sport, format FROM tournament_brackets WHERE event_id = $1",
      [eventId]
    )
  ).rows[0];

  if (!bracketRow) return null;
  const bracketId = bracketRow.id as string;

  const teamsRows = (
    await db().query(
      "SELECT id, seed, name, city, record, coach FROM tournament_teams WHERE bracket_id = $1 ORDER BY seed ASC",
      [bracketId]
    )
  ).rows;

  const teams: Team[] = teamsRows.map((r) => ({
    id: r.id as string,
    seed: r.seed as number,
    name: r.name as string,
    city: (r.city as string) || undefined,
    record: (r.record as string) || undefined,
    coach: (r.coach as string) || undefined,
  }));

  const teamMap = new Map<string, Team>();
  for (const t of teams) {
    teamMap.set(t.id, t);
  }

  const matchesRows = (
    await db().query(
      `SELECT match_key, round, round_name, bracket_type, court, scheduled_time,
              team_a_id, team_b_id, score_a, score_b, status, winner_id, loser_id,
              next_match_key, next_match_slot, loser_match_key, loser_match_slot
       FROM tournament_matches
       WHERE bracket_id = $1
       ORDER BY round ASC, match_key ASC`,
      [bracketId]
    )
  ).rows;

  // Group matches into rounds
  const roundMap = new Map<number, TournamentRound>();
  for (const row of matchesRows) {
    const roundNum = row.round as number;
    if (!roundMap.has(roundNum)) {
      roundMap.set(roundNum, {
        round: roundNum,
        roundName: row.round_name as string,
        matches: [],
      });
    }

    const match: Match = {
      id: row.match_key as string,
      round: roundNum,
      roundName: row.round_name as string,
      bracketType: row.bracket_type as Match["bracketType"],
      court: row.court as string,
      scheduledTime: row.scheduled_time as string,
      teamA: row.team_a_id ? teamMap.get(row.team_a_id) : undefined,
      teamB: row.team_b_id ? teamMap.get(row.team_b_id) : undefined,
      scoreA: row.score_a !== null ? (row.score_a as number) : undefined,
      scoreB: row.score_b !== null ? (row.score_b as number) : undefined,
      status: row.status as Match["status"],
      winnerId: (row.winner_id as string) || undefined,
      loserId: (row.loser_id as string) || undefined,
      nextMatchId: (row.next_match_key as string) || undefined,
      nextMatchSlot: (row.next_match_slot as Match["nextMatchSlot"]) || undefined,
      loserMatchId: (row.loser_match_key as string) || undefined,
      loserMatchSlot: (row.loser_match_slot as Match["loserMatchSlot"]) || undefined,
    };

    roundMap.get(roundNum)!.matches.push(match);
  }

  const rounds = Array.from(roundMap.values()).sort((a, b) => a.round - b.round);

  return {
    id: bracketId,
    name: bracketRow.name as string,
    sport: bracketRow.sport as string,
    format: bracketRow.format as TournamentBracket["format"],
    teams,
    rounds,
  };
}

/**
 * Creates or resets a real tournament bracket for an event.
 * Validates participating teams, seeds them, and persists all rounds and matches into Postgres.
 */
export async function createOrResetTournamentBracket(
  actor: { userId: string; role: string },
  eventId: string,
  format: "single_elimination" | "double_elimination",
  teamInputs: TeamInput[]
): Promise<Result> {
  if (!validId(eventId)) return fail("Invalid event ID.");
  const teamVal = validateTeamInputs(teamInputs);
  if (!teamVal.valid) return fail(teamVal.error);

  return tx(async (c) => {
    const allowed = await canManageEventBracket(c, actor.userId, actor.role, eventId);
    if (!allowed) return fail("Only the event organizer or administrator can manage tournament brackets.");

    const eventRow = (await c.query("SELECT name, sport, status FROM events WHERE id = $1 FOR UPDATE", [eventId])).rows[0];
    if (!eventRow) return fail("Event not found.");
    if (eventRow.status === "cancelled") return fail("Cannot create a tournament bracket for a cancelled event.");

    // Delete any existing bracket for this event (cascade removes teams & matches)
    await c.query("DELETE FROM tournament_brackets WHERE event_id = $1", [eventId]);

    // Insert new bracket header
    const bracketInsert = await c.query(
      `INSERT INTO tournament_brackets (event_id, name, sport, format, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [eventId, eventRow.name, eventRow.sport || "Basketball", format, actor.userId]
    );
    const bracketId = bracketInsert.rows[0].id as string;

    // Insert teams and map seed -> real team UUID
    const teamDbMap = new Map<number, string>();
    for (const t of teamInputs) {
      const inserted = await c.query(
        `INSERT INTO tournament_teams (bracket_id, seed, name, city, record, coach)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          bracketId,
          t.seed,
          t.name.trim(),
          t.city?.trim() || "",
          t.record?.trim() || "",
          t.coach?.trim() || "",
        ]
      );
      teamDbMap.set(t.seed, inserted.rows[0].id as string);
    }

    // Build seeded Team objects with database UUIDs for bracket generator
    const domainTeams: Team[] = teamInputs.map((t) => ({
      id: teamDbMap.get(t.seed)!,
      name: t.name.trim(),
      seed: t.seed,
      city: t.city?.trim(),
      record: t.record?.trim(),
      coach: t.coach?.trim(),
    }));

    // Generate bracket structure
    const generated =
      format === "double_elimination"
        ? generateDoubleEliminationBracket(eventRow.name, eventRow.sport || "Basketball", domainTeams)
        : generateSingleEliminationBracket(eventRow.name, eventRow.sport || "Basketball", domainTeams);

    // Persist all generated matches to Postgres
    for (const round of generated.rounds) {
      for (const m of round.matches) {
        await c.query(
          `INSERT INTO tournament_matches (
             bracket_id, match_key, round, round_name, bracket_type,
             court, scheduled_time, team_a_id, team_b_id, status,
             next_match_key, next_match_slot, loser_match_key, loser_match_slot
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            bracketId,
            m.id,
            m.round,
            m.roundName,
            m.bracketType || "winners",
            m.court,
            m.scheduledTime,
            m.teamA?.id || null,
            m.teamB?.id || null,
            "scheduled",
            m.nextMatchId || null,
            m.nextMatchSlot || null,
            m.loserMatchId || null,
            m.loserMatchSlot || null,
          ]
        );
      }
    }

    return { ok: true, message: "Tournament bracket created successfully." };
  });
}

/**
 * Records a match score in the database and automatically advances the winner (and loser in double elimination).
 */
export async function recordMatchScoreInDb(
  actor: { userId: string; role: string },
  eventId: string,
  matchKey: string,
  scoreA: number,
  scoreB: number,
  isFinal: boolean
): Promise<Result> {
  if (!validId(eventId)) return fail("Invalid event ID.");
  if (!matchKey || matchKey.trim().length === 0) return fail("Invalid match key.");
  const scoreVal = validateScoreInputs(scoreA, scoreB, isFinal);
  if (!scoreVal.valid) return fail(scoreVal.error);

  return tx(async (c) => {
    const allowed = await canManageEventBracket(c, actor.userId, actor.role, eventId);
    if (!allowed) return fail("Only the event organizer or scorekeeper can record match scores.");

    const bracketRow = (
      await c.query("SELECT id, format, name, sport FROM tournament_brackets WHERE event_id = $1 FOR UPDATE", [eventId])
    ).rows[0];
    if (!bracketRow) return fail("No tournament bracket found for this event.");
    const bracketId = bracketRow.id as string;

    const matchRow = (
      await c.query(
        "SELECT id, match_key, team_a_id, team_b_id, next_match_key, next_match_slot, loser_match_key, loser_match_slot FROM tournament_matches WHERE bracket_id = $1 AND match_key = $2 FOR UPDATE",
        [bracketId, matchKey]
      )
    ).rows[0];

    if (!matchRow) return fail("Match not found in tournament bracket.");
    if (!matchRow.team_a_id || !matchRow.team_b_id) {
      return fail("Cannot record scores for a matchup where both teams are not yet determined.");
    }

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (isFinal) {
      if (scoreA > scoreB) {
        winnerId = matchRow.team_a_id;
        loserId = matchRow.team_b_id;
      } else {
        winnerId = matchRow.team_b_id;
        loserId = matchRow.team_a_id;
      }
    }

    const status = isFinal ? "final" : "live";

    // Update current match
    await c.query(
      `UPDATE tournament_matches
       SET score_a = $3, score_b = $4, status = $5, winner_id = $6, loser_id = $7
       WHERE bracket_id = $1 AND match_key = $2`,
      [bracketId, matchKey, scoreA, scoreB, status, winnerId, loserId]
    );

    // If final, advance teams to their next assigned match slots
    if (isFinal && winnerId) {
      if (matchRow.next_match_key && matchRow.next_match_slot) {
        const col = matchRow.next_match_slot === "teamA" ? "team_a_id" : "team_b_id";
        await c.query(
          `UPDATE tournament_matches
           SET ${col} = $3
           WHERE bracket_id = $1 AND match_key = $2`,
          [bracketId, matchRow.next_match_key, winnerId]
        );
      }

      if (loserId && matchRow.loser_match_key && matchRow.loser_match_slot) {
        const col = matchRow.loser_match_slot === "teamA" ? "team_a_id" : "team_b_id";
        await c.query(
          `UPDATE tournament_matches
           SET ${col} = $3
           WHERE bracket_id = $1 AND match_key = $2`,
          [bracketId, matchRow.loser_match_key, loserId]
        );
      }
    }

    await c.query("UPDATE tournament_brackets SET updated_at = now() WHERE id = $1", [bracketId]);

    return { ok: true, message: isFinal ? "Final score recorded and winner advanced." : "Live score updated." };
  });
}

/**
 * Deletes the tournament bracket for an event.
 */
export async function deleteTournamentBracket(
  actor: { userId: string; role: string },
  eventId: string
): Promise<Result> {
  if (!validId(eventId)) return fail("Invalid event ID.");

  return tx(async (c) => {
    const allowed = await canManageEventBracket(c, actor.userId, actor.role, eventId);
    if (!allowed) return fail("Only the event organizer can delete tournament brackets.");

    const res = await c.query("DELETE FROM tournament_brackets WHERE event_id = $1", [eventId]);
    if ((res.rowCount ?? 0) === 0) return fail("No bracket found to delete.");

    return { ok: true, message: "Tournament bracket deleted." };
  });
}

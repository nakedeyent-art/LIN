import { db } from "./db";
import { validId } from "./operations";
import type { HighlightReel, VideoClip } from "./video-vault";

/**
 * Loads real highlight video reels for a specific athlete from scouting reports.
 */
export async function loadRealAthleteReels(athleteId: string): Promise<HighlightReel[]> {
  if (!validId(athleteId)) return [];

  try {
    const res = await db().query(
      `SELECT r.id, r.athlete_id, r.title, r.notes, r.film_url, r.observed_on, r.created_at,
              u.full_name AS athlete_name, ap.sport,
              e.name AS event_name
       FROM scouting_reports r
       JOIN users u ON u.id = r.athlete_id
       LEFT JOIN athlete_profiles ap ON ap.user_id = r.athlete_id
       LEFT JOIN events e ON e.id = r.event_id
       WHERE r.athlete_id = $1 AND r.film_url IS NOT NULL AND length(trim(r.film_url)) > 0
       ORDER BY r.observed_on DESC`,
      [athleteId]
    );

    return res.rows.map((r): HighlightReel => {
      const clips: VideoClip[] = [
        {
          id: `clip-${r.id}-1`,
          timestamp: "00:00",
          seconds: 0,
          title: `${r.title} - Full Cut`,
          skillCategory: "Basketball IQ & Read",
          description: r.notes ? r.notes.slice(0, 160) : "Scout game observation",
          rating: 4,
        },
      ];

      return {
        id: r.id,
        athleteId: r.athlete_id,
        athleteName: r.athlete_name || "Prospect",
        sport: r.sport || "Basketball",
        title: r.title,
        gameOrEvent: r.event_name || "Game / Showcase Film",
        videoUrl: r.film_url,
        durationSeconds: 180,
        recordedDate: new Date(r.observed_on).toISOString().slice(0, 10),
        verifiedGameFilm: true,
        clips,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Loads real highlight video reels created or scouted by a recruiter across all prospect reports.
 */
export async function loadRecruiterVaultReels(recruiterId: string): Promise<HighlightReel[]> {
  if (!validId(recruiterId)) return [];

  try {
    const res = await db().query(
      `SELECT r.id, r.athlete_id, r.title, r.notes, r.film_url, r.observed_on, r.created_at,
              u.full_name AS athlete_name, ap.sport,
              e.name AS event_name
       FROM scouting_reports r
       JOIN users u ON u.id = r.athlete_id
       LEFT JOIN athlete_profiles ap ON ap.user_id = r.athlete_id
       LEFT JOIN events e ON e.id = r.event_id
       WHERE r.author_id = $1 AND r.film_url IS NOT NULL AND length(trim(r.film_url)) > 0
       ORDER BY r.observed_on DESC
       LIMIT 50`,
      [recruiterId]
    );

    return res.rows.map((r): HighlightReel => {
      const clips: VideoClip[] = [
        {
          id: `clip-${r.id}-1`,
          timestamp: "00:00",
          seconds: 0,
          title: `${r.title} - Key Sequences`,
          skillCategory: "Basketball IQ & Read",
          description: r.notes ? r.notes.slice(0, 160) : "Scout game observation",
          rating: 4,
        },
      ];

      return {
        id: r.id,
        athleteId: r.athlete_id,
        athleteName: r.athlete_name || "Prospect",
        sport: r.sport || "Basketball",
        title: r.title,
        gameOrEvent: r.event_name || "Game / Showcase Film",
        videoUrl: r.film_url,
        durationSeconds: 180,
        recordedDate: new Date(r.observed_on).toISOString().slice(0, 10),
        verifiedGameFilm: true,
        clips,
      };
    });
  } catch {
    return [];
  }
}

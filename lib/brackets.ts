/**
 * Tournament Bracket & Match Scheduling Engine
 * Pure domain logic for single elimination brackets, standard seeding pairings,
 * court/field scheduling, and match progression.
 */

export type Team = {
  id: string;
  name: string;
  seed: number;
  record?: string;
  coach?: string;
  city?: string;
};

export type MatchStatus = "scheduled" | "live" | "final";

export type Match = {
  id: string;
  round: number;
  roundName: string;
  court: string;
  scheduledTime: string;
  teamA?: Team;
  teamB?: Team;
  scoreA?: number;
  scoreB?: number;
  status: MatchStatus;
  winnerId?: string;
  nextMatchId?: string;
  nextMatchSlot?: "teamA" | "teamB";
};

export type TournamentRound = {
  round: number;
  roundName: string;
  matches: Match[];
};

export type TournamentBracket = {
  id: string;
  name: string;
  sport: string;
  format: "single_elimination" | "double_elimination" | "pool_play";
  teams: Team[];
  rounds: TournamentRound[];
};

const DEFAULT_COURTS = ["Main Court", "Court 2", "Court 3", "Aux Gym"];

/**
 * Standard single elimination bracket pairings:
 * 4 teams: [1 vs 4, 2 vs 3]
 * 8 teams: [1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6]
 */
export function getSeedingPairs(numTeams: number): [number, number][] {
  if (numTeams === 4) {
    return [
      [1, 4],
      [2, 3],
    ];
  }
  if (numTeams === 8) {
    return [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ];
  }
  // Fallback linear pairs
  const pairs: [number, number][] = [];
  for (let i = 1; i <= numTeams / 2; i++) {
    pairs.push([i, numTeams - i + 1]);
  }
  return pairs;
}

export function getRoundName(roundNumber: number, totalRounds: number): string {
  const fromFinal = totalRounds - roundNumber;
  if (fromFinal === 0) return "Championship";
  if (fromFinal === 1) return "Semifinals";
  if (fromFinal === 2) return "Quarterfinals";
  if (fromFinal === 3) return "Round of 16";
  return `Round ${roundNumber}`;
}

export function generateSingleEliminationBracket(
  name: string,
  sport: string,
  teams: Team[],
  courts: string[] = DEFAULT_COURTS
): TournamentBracket {
  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);
  const numTeams = sortedTeams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));

  const rounds: TournamentRound[] = [];
  const allMatches: Map<string, Match> = new Map();

  // Create rounds backwards or forward with links
  let currentRoundMatchesCount = Math.floor(numTeams / 2);

  // Generate round skeleton
  for (let r = 1; r <= numRounds; r++) {
    const roundName = getRoundName(r, numRounds);
    const matches: Match[] = [];

    for (let m = 0; m < currentRoundMatchesCount; m++) {
      const matchId = `r${r}-m${m + 1}`;
      const court = courts[m % courts.length] || "Court 1";
      const startHour = 9 + (r - 1) * 2 + Math.floor(m / 2);
      const scheduledTime = `${startHour > 12 ? startHour - 12 : startHour}:00 ${startHour >= 12 ? "PM" : "AM"}`;

      const match: Match = {
        id: matchId,
        round: r,
        roundName,
        court,
        scheduledTime,
        status: "scheduled",
      };

      matches.push(match);
      allMatches.set(matchId, match);
    }

    rounds.push({ round: r, roundName, matches });
    currentRoundMatchesCount = Math.floor(currentRoundMatchesCount / 2);
  }

  // Link matches to next rounds
  for (let r = 1; r < numRounds; r++) {
    const currentMatches = rounds[r - 1].matches;
    for (let m = 0; m < currentMatches.length; m++) {
      const nextMatchIndex = Math.floor(m / 2);
      const nextMatchId = `r${r + 1}-m${nextMatchIndex + 1}`;
      const nextSlot = m % 2 === 0 ? "teamA" : "teamB";

      currentMatches[m].nextMatchId = nextMatchId;
      currentMatches[m].nextMatchSlot = nextSlot;
    }
  }

  // Populate Round 1 teams based on seeding
  const pairs = getSeedingPairs(numTeams);
  const round1Matches = rounds[0].matches;

  for (let i = 0; i < round1Matches.length && i < pairs.length; i++) {
    const [seedA, seedB] = pairs[i];
    const teamA = sortedTeams.find((t) => t.seed === seedA);
    const teamB = sortedTeams.find((t) => t.seed === seedB);

    round1Matches[i].teamA = teamA;
    round1Matches[i].teamB = teamB;
  }

  return {
    id: `tourney-${Date.now()}`,
    name,
    sport,
    format: "single_elimination",
    teams: sortedTeams,
    rounds,
  };
}

export function updateMatchScore(
  bracket: TournamentBracket,
  matchId: string,
  scoreA: number,
  scoreB: number,
  isFinal: boolean
): TournamentBracket {
  const newRounds = bracket.rounds.map((round) => {
    const newMatches = round.matches.map((m) => {
      if (m.id !== matchId) return m;

      let winnerId = m.winnerId;
      if (isFinal) {
        if (scoreA > scoreB) {
          winnerId = m.teamA?.id;
        } else if (scoreB > scoreA) {
          winnerId = m.teamB?.id;
        }
      }

      return {
        ...m,
        scoreA,
        scoreB,
        status: isFinal ? ("final" as const) : ("live" as const),
        winnerId,
      };
    });

    return { ...round, matches: newMatches };
  });

  // If a winner was decided and there's a next match, advance them
  let updatedBracket: TournamentBracket = { ...bracket, rounds: newRounds };
  const currentMatch = findMatch(updatedBracket, matchId);

  if (currentMatch && isFinal && currentMatch.winnerId && currentMatch.nextMatchId && currentMatch.nextMatchSlot) {
    const winningTeam =
      currentMatch.winnerId === currentMatch.teamA?.id ? currentMatch.teamA : currentMatch.teamB;
    if (winningTeam) {
      updatedBracket = advanceTeamToMatch(
        updatedBracket,
        currentMatch.nextMatchId,
        currentMatch.nextMatchSlot,
        winningTeam
      );
    }
  }

  return updatedBracket;
}

export function findMatch(bracket: TournamentBracket, matchId: string): Match | undefined {
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      if (match.id === matchId) return match;
    }
  }
  return undefined;
}

function advanceTeamToMatch(
  bracket: TournamentBracket,
  targetMatchId: string,
  slot: "teamA" | "teamB",
  team: Team
): TournamentBracket {
  const newRounds = bracket.rounds.map((round) => {
    const newMatches = round.matches.map((m) => {
      if (m.id !== targetMatchId) return m;
      return {
        ...m,
        [slot]: team,
      };
    });
    return { ...round, matches: newMatches };
  });

  return { ...bracket, rounds: newRounds };
}

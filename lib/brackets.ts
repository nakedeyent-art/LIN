/**
 * Tournament Bracket & Match Scheduling Engine
 * Pure domain logic for single elimination & double elimination brackets, standard seeding pairings,
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
  bracketType?: "winners" | "losers" | "finals";
  court: string;
  scheduledTime: string;
  teamA?: Team;
  teamB?: Team;
  scoreA?: number;
  scoreB?: number;
  status: MatchStatus;
  winnerId?: string;
  loserId?: string;
  nextMatchId?: string;
  nextMatchSlot?: "teamA" | "teamB";
  loserMatchId?: string;
  loserMatchSlot?: "teamA" | "teamB";
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

  let currentRoundMatchesCount = Math.floor(numTeams / 2);

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
        bracketType: r === numRounds ? "finals" : "winners",
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
    id: `tourney-se-${Date.now()}`,
    name,
    sport,
    format: "single_elimination",
    teams: sortedTeams,
    rounds,
  };
}

/**
 * Generate a complete Double Elimination Bracket with Winners Bracket, Losers/Consolation Bracket,
 * and Grand Championship.
 */
export function generateDoubleEliminationBracket(
  name: string,
  sport: string,
  teams: Team[],
  courts: string[] = DEFAULT_COURTS
): TournamentBracket {
  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);

  // We build a standard 4-team or 8-team double elimination structure
  if (sortedTeams.length <= 4) {
    const rounds: TournamentRound[] = [
      {
        round: 1,
        roundName: "Winners Semifinals",
        matches: [
          {
            id: "wb-sf1",
            round: 1,
            roundName: "Winners Semifinal 1",
            bracketType: "winners",
            court: courts[0],
            scheduledTime: "10:00 AM",
            teamA: sortedTeams.find((t) => t.seed === 1),
            teamB: sortedTeams.find((t) => t.seed === 4),
            status: "scheduled",
            nextMatchId: "wb-final",
            nextMatchSlot: "teamA",
            loserMatchId: "lb-r1",
            loserMatchSlot: "teamA",
          },
          {
            id: "wb-sf2",
            round: 1,
            roundName: "Winners Semifinal 2",
            bracketType: "winners",
            court: courts[1] || courts[0],
            scheduledTime: "11:30 AM",
            teamA: sortedTeams.find((t) => t.seed === 2),
            teamB: sortedTeams.find((t) => t.seed === 3),
            status: "scheduled",
            nextMatchId: "wb-final",
            nextMatchSlot: "teamB",
            loserMatchId: "lb-r1",
            loserMatchSlot: "teamB",
          },
        ],
      },
      {
        round: 2,
        roundName: "Winners Final & Losers Round 1",
        matches: [
          {
            id: "wb-final",
            round: 2,
            roundName: "Winners Final",
            bracketType: "winners",
            court: courts[0],
            scheduledTime: "1:00 PM",
            status: "scheduled",
            nextMatchId: "grand-final",
            nextMatchSlot: "teamA",
            loserMatchId: "lb-final",
            loserMatchSlot: "teamA",
          },
          {
            id: "lb-r1",
            round: 2,
            roundName: "Losers Elimination",
            bracketType: "losers",
            court: courts[1] || courts[0],
            scheduledTime: "1:00 PM",
            status: "scheduled",
            nextMatchId: "lb-final",
            nextMatchSlot: "teamB",
          },
        ],
      },
      {
        round: 3,
        roundName: "Losers Championship",
        matches: [
          {
            id: "lb-final",
            round: 3,
            roundName: "Losers Final",
            bracketType: "losers",
            court: courts[0],
            scheduledTime: "3:00 PM",
            status: "scheduled",
            nextMatchId: "grand-final",
            nextMatchSlot: "teamB",
          },
        ],
      },
      {
        round: 4,
        roundName: "Grand Championship",
        matches: [
          {
            id: "grand-final",
            round: 4,
            roundName: "Grand Finals",
            bracketType: "finals",
            court: courts[0],
            scheduledTime: "5:00 PM",
            status: "scheduled",
          },
        ],
      },
    ];

    return {
      id: `tourney-de-${Date.now()}`,
      name,
      sport,
      format: "double_elimination",
      teams: sortedTeams,
      rounds,
    };
  }

  // 8-Team Double Elimination Structure
  const rounds: TournamentRound[] = [
    {
      round: 1,
      roundName: "Winners Quarterfinals",
      matches: [
        {
          id: "de-wqf-1",
          round: 1,
          roundName: "Winners QF 1",
          bracketType: "winners",
          court: courts[0],
          scheduledTime: "9:00 AM",
          teamA: sortedTeams.find((t) => t.seed === 1),
          teamB: sortedTeams.find((t) => t.seed === 8),
          status: "scheduled",
          nextMatchId: "de-wsf-1",
          nextMatchSlot: "teamA",
          loserMatchId: "de-lr1-1",
          loserMatchSlot: "teamA",
        },
        {
          id: "de-wqf-2",
          round: 1,
          roundName: "Winners QF 2",
          bracketType: "winners",
          court: courts[1] || courts[0],
          scheduledTime: "9:00 AM",
          teamA: sortedTeams.find((t) => t.seed === 4),
          teamB: sortedTeams.find((t) => t.seed === 5),
          status: "scheduled",
          nextMatchId: "de-wsf-1",
          nextMatchSlot: "teamB",
          loserMatchId: "de-lr1-1",
          loserMatchSlot: "teamB",
        },
        {
          id: "de-wqf-3",
          round: 1,
          roundName: "Winners QF 3",
          bracketType: "winners",
          court: courts[2] || courts[0],
          scheduledTime: "10:30 AM",
          teamA: sortedTeams.find((t) => t.seed === 2),
          teamB: sortedTeams.find((t) => t.seed === 7),
          status: "scheduled",
          nextMatchId: "de-wsf-2",
          nextMatchSlot: "teamA",
          loserMatchId: "de-lr1-2",
          loserMatchSlot: "teamA",
        },
        {
          id: "de-wqf-4",
          round: 1,
          roundName: "Winners QF 4",
          bracketType: "winners",
          court: courts[3] || courts[1] || courts[0],
          scheduledTime: "10:30 AM",
          teamA: sortedTeams.find((t) => t.seed === 3),
          teamB: sortedTeams.find((t) => t.seed === 6),
          status: "scheduled",
          nextMatchId: "de-wsf-2",
          nextMatchSlot: "teamB",
          loserMatchId: "de-lr1-2",
          loserMatchSlot: "teamB",
        },
      ],
    },
    {
      round: 2,
      roundName: "Winners Semifinals & Losers R1",
      matches: [
        {
          id: "de-wsf-1",
          round: 2,
          roundName: "Winners Semifinal 1",
          bracketType: "winners",
          court: courts[0],
          scheduledTime: "12:00 PM",
          status: "scheduled",
          nextMatchId: "de-wfinal",
          nextMatchSlot: "teamA",
          loserMatchId: "de-lr2-1",
          loserMatchSlot: "teamA",
        },
        {
          id: "de-wsf-2",
          round: 2,
          roundName: "Winners Semifinal 2",
          bracketType: "winners",
          court: courts[1] || courts[0],
          scheduledTime: "12:00 PM",
          status: "scheduled",
          nextMatchId: "de-wfinal",
          nextMatchSlot: "teamB",
          loserMatchId: "de-lr2-2",
          loserMatchSlot: "teamA",
        },
        {
          id: "de-lr1-1",
          round: 2,
          roundName: "Losers Round 1 (A)",
          bracketType: "losers",
          court: courts[2] || courts[0],
          scheduledTime: "1:30 PM",
          status: "scheduled",
          nextMatchId: "de-lr2-1",
          nextMatchSlot: "teamB",
        },
        {
          id: "de-lr1-2",
          round: 2,
          roundName: "Losers Round 1 (B)",
          bracketType: "losers",
          court: courts[3] || courts[1] || courts[0],
          scheduledTime: "1:30 PM",
          status: "scheduled",
          nextMatchId: "de-lr2-2",
          nextMatchSlot: "teamB",
        },
      ],
    },
    {
      round: 3,
      roundName: "Winners Final & Losers Semifinal",
      matches: [
        {
          id: "de-wfinal",
          round: 3,
          roundName: "Winners Final",
          bracketType: "winners",
          court: courts[0],
          scheduledTime: "3:00 PM",
          status: "scheduled",
          nextMatchId: "de-grand-final",
          nextMatchSlot: "teamA",
          loserMatchId: "de-lfinal",
          loserMatchSlot: "teamA",
        },
        {
          id: "de-lr2-1",
          round: 3,
          roundName: "Losers Quarterfinal 1",
          bracketType: "losers",
          court: courts[1] || courts[0],
          scheduledTime: "3:00 PM",
          status: "scheduled",
          nextMatchId: "de-lsemi",
          nextMatchSlot: "teamA",
        },
        {
          id: "de-lr2-2",
          round: 3,
          roundName: "Losers Quarterfinal 2",
          bracketType: "losers",
          court: courts[2] || courts[0],
          scheduledTime: "4:00 PM",
          status: "scheduled",
          nextMatchId: "de-lsemi",
          nextMatchSlot: "teamB",
        },
      ],
    },
    {
      round: 4,
      roundName: "Losers Semifinal & Final",
      matches: [
        {
          id: "de-lsemi",
          round: 4,
          roundName: "Losers Semifinal",
          bracketType: "losers",
          court: courts[1] || courts[0],
          scheduledTime: "5:30 PM",
          status: "scheduled",
          nextMatchId: "de-lfinal",
          nextMatchSlot: "teamB",
        },
        {
          id: "de-lfinal",
          round: 4,
          roundName: "Losers Final",
          bracketType: "losers",
          court: courts[0],
          scheduledTime: "6:45 PM",
          status: "scheduled",
          nextMatchId: "de-grand-final",
          nextMatchSlot: "teamB",
        },
      ],
    },
    {
      round: 5,
      roundName: "Grand Championship",
      matches: [
        {
          id: "de-grand-final",
          round: 5,
          roundName: "Grand Championship",
          bracketType: "finals",
          court: courts[0],
          scheduledTime: "8:00 PM",
          status: "scheduled",
        },
      ],
    },
  ];

  return {
    id: `tourney-de-${Date.now()}`,
    name,
    sport,
    format: "double_elimination",
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
      let loserId = m.loserId;
      if (isFinal) {
        if (scoreA > scoreB) {
          winnerId = m.teamA?.id;
          loserId = m.teamB?.id;
        } else if (scoreB > scoreA) {
          winnerId = m.teamB?.id;
          loserId = m.teamA?.id;
        }
      }

      return {
        ...m,
        scoreA,
        scoreB,
        status: isFinal ? ("final" as const) : ("live" as const),
        winnerId,
        loserId,
      };
    });

    return { ...round, matches: newMatches };
  });

  let updatedBracket: TournamentBracket = { ...bracket, rounds: newRounds };
  const currentMatch = findMatch(updatedBracket, matchId);

  if (currentMatch && isFinal && currentMatch.winnerId) {
    const winningTeam =
      currentMatch.winnerId === currentMatch.teamA?.id ? currentMatch.teamA : currentMatch.teamB;
    const losingTeam =
      currentMatch.loserId === currentMatch.teamA?.id ? currentMatch.teamA : currentMatch.teamB;

    // Advance winner
    if (winningTeam && currentMatch.nextMatchId && currentMatch.nextMatchSlot) {
      updatedBracket = advanceTeamToMatch(
        updatedBracket,
        currentMatch.nextMatchId,
        currentMatch.nextMatchSlot,
        winningTeam
      );
    }

    // Advance loser if double elimination
    if (losingTeam && currentMatch.loserMatchId && currentMatch.loserMatchSlot) {
      updatedBracket = advanceTeamToMatch(
        updatedBracket,
        currentMatch.loserMatchId,
        currentMatch.loserMatchSlot,
        losingTeam
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

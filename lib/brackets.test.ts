import { describe, expect, it } from "vitest";
import {
  generateDoubleEliminationBracket,
  generateSingleEliminationBracket,
  getRoundName,
  getSeedingPairs,
  updateMatchScore,
  type Team,
} from "./brackets";

const TEAMS_4: Team[] = [
  { id: "t1", name: "Metro Hawks", seed: 1, city: "Atlanta" },
  { id: "t2", name: "Bay Area Titans", seed: 2, city: "San Francisco" },
  { id: "t3", name: "Windy City Elite", seed: 3, city: "Chicago" },
  { id: "t4", name: "Lone Star Rebels", seed: 4, city: "Dallas" },
];

const TEAMS_8: Team[] = [
  { id: "t1", name: "Metro Hawks", seed: 1 },
  { id: "t2", name: "Bay Area Titans", seed: 2 },
  { id: "t3", name: "Windy City Elite", seed: 3 },
  { id: "t4", name: "Lone Star Rebels", seed: 4 },
  { id: "t5", name: "Philly Express", seed: 5 },
  { id: "t6", name: "Miami Surge", seed: 6 },
  { id: "t7", name: "Seattle Cascade", seed: 7 },
  { id: "t8", name: "Denver Peaks", seed: 8 },
];

describe("Tournament Bracket & Match Scheduling Engine", () => {
  describe("Seeding & Round Names", () => {
    it("generates correct seeding pairs for 4 teams", () => {
      expect(getSeedingPairs(4)).toEqual([
        [1, 4],
        [2, 3],
      ]);
    });

    it("generates standard tournament seeding pairs for 8 teams", () => {
      expect(getSeedingPairs(8)).toEqual([
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6],
      ]);
    });

    it("names rounds properly based on total depth", () => {
      // For a 3-round tournament (8 teams)
      expect(getRoundName(1, 3)).toBe("Quarterfinals");
      expect(getRoundName(2, 3)).toBe("Semifinals");
      expect(getRoundName(3, 3)).toBe("Championship");
    });
  });

  describe("Bracket Generation (4 Teams Single Elimination)", () => {
    it("creates a 2-round bracket with 2 semifinal matches and 1 final", () => {
      const b = generateSingleEliminationBracket("Summer Invitational", "Basketball", TEAMS_4);
      expect(b.rounds.length).toBe(2);
      expect(b.rounds[0].roundName).toBe("Semifinals");
      expect(b.rounds[0].matches.length).toBe(2);
      expect(b.rounds[1].roundName).toBe("Championship");
      expect(b.rounds[1].matches.length).toBe(1);

      // Verify seeding in SF
      expect(b.rounds[0].matches[0].teamA?.name).toBe("Metro Hawks");
      expect(b.rounds[0].matches[0].teamB?.name).toBe("Lone Star Rebels");
      expect(b.rounds[0].matches[1].teamA?.name).toBe("Bay Area Titans");
      expect(b.rounds[0].matches[1].teamB?.name).toBe("Windy City Elite");

      // Verify linkages
      expect(b.rounds[0].matches[0].nextMatchId).toBe("r2-m1");
      expect(b.rounds[0].matches[0].nextMatchSlot).toBe("teamA");
      expect(b.rounds[0].matches[1].nextMatchId).toBe("r2-m1");
      expect(b.rounds[0].matches[1].nextMatchSlot).toBe("teamB");
    });
  });

  describe("Bracket Generation (8 Teams Single Elimination)", () => {
    it("creates a 3-round bracket with 4 QF, 2 SF, and 1 Finals", () => {
      const b = generateSingleEliminationBracket("Elite 8 Showcase", "Basketball", TEAMS_8);
      expect(b.rounds.length).toBe(3);
      expect(b.rounds[0].matches.length).toBe(4);
      expect(b.rounds[1].matches.length).toBe(2);
      expect(b.rounds[2].matches.length).toBe(1);

      // QF match 1: 1 vs 8
      expect(b.rounds[0].matches[0].teamA?.seed).toBe(1);
      expect(b.rounds[0].matches[0].teamB?.seed).toBe(8);

      // QF match 2: 4 vs 5
      expect(b.rounds[0].matches[1].teamA?.seed).toBe(4);
      expect(b.rounds[0].matches[1].teamB?.seed).toBe(5);
    });
  });

  describe("Double Elimination Bracket Engine", () => {
    it("generates a 4-round double elimination bracket for 4 teams", () => {
      const de = generateDoubleEliminationBracket("Gold Cup Double Elimination", "Basketball", TEAMS_4);
      expect(de.format).toBe("double_elimination");
      expect(de.rounds.length).toBe(4);

      // Round 1 has winners SF1 & SF2
      expect(de.rounds[0].matches.length).toBe(2);
      expect(de.rounds[0].matches[0].bracketType).toBe("winners");

      // Verify loserMatchId is configured to drop into Losers Bracket
      expect(de.rounds[0].matches[0].loserMatchId).toBe("lb-r1");
      expect(de.rounds[0].matches[0].loserMatchSlot).toBe("teamA");
      expect(de.rounds[0].matches[1].loserMatchId).toBe("lb-r1");
      expect(de.rounds[0].matches[1].loserMatchSlot).toBe("teamB");
    });

    it("advances winner to Winners Finals and sends loser to Losers Bracket", () => {
      const de = generateDoubleEliminationBracket("Gold Cup Double Elimination", "Basketball", TEAMS_4);
      // Team 1 wins against Team 4 (90 - 70)
      const afterSF1 = updateMatchScore(de, "wb-sf1", 90, 70, true);
      const sf1 = afterSF1.rounds[0].matches[0];
      expect(sf1.winnerId).toBe("t1");
      expect(sf1.loserId).toBe("t4");

      // Verify winner (Metro Hawks) went to Winners Final as teamA
      const wbFinal = afterSF1.rounds[1].matches[0];
      expect(wbFinal.teamA?.name).toBe("Metro Hawks");

      // Verify loser (Lone Star Rebels) dropped into Losers Elimination as teamA
      const lbR1 = afterSF1.rounds[1].matches[1];
      expect(lbR1.teamA?.name).toBe("Lone Star Rebels");
    });
  });

  describe("Match Scoring & Winner Progression", () => {
    it("updates live score and marks game as live without advancing early", () => {
      const b = generateSingleEliminationBracket("Summer Invitational", "Basketball", TEAMS_4);
      const updated = updateMatchScore(b, "r1-m1", 34, 28, false);
      const m = updated.rounds[0].matches[0];
      expect(m.scoreA).toBe(34);
      expect(m.scoreB).toBe(28);
      expect(m.status).toBe("live");
      expect(m.winnerId).toBeUndefined();

      // Finals should still have empty teamA
      expect(updated.rounds[1].matches[0].teamA).toBeUndefined();
    });

    it("finalizes score, decides winner, and advances winning team to the Championship match", () => {
      const b = generateSingleEliminationBracket("Summer Invitational", "Basketball", TEAMS_4);
      // Team A (Metro Hawks) wins 78 to 72 against Team B (Lone Star Rebels)
      const afterSF1 = updateMatchScore(b, "r1-m1", 78, 72, true);
      const sf1 = afterSF1.rounds[0].matches[0];
      expect(sf1.status).toBe("final");
      expect(sf1.winnerId).toBe("t1");

      // Verify Metro Hawks advanced to Championship as teamA
      const finals = afterSF1.rounds[1].matches[0];
      expect(finals.teamA?.id).toBe("t1");
      expect(finals.teamA?.name).toBe("Metro Hawks");
      expect(finals.teamB).toBeUndefined();

      // Now complete SF2: Team B (Windy City Elite) upsets Team A (Bay Area Titans)
      const afterSF2 = updateMatchScore(afterSF1, "r1-m2", 65, 70, true);
      const sf2 = afterSF2.rounds[0].matches[1];
      expect(sf2.winnerId).toBe("t3");

      // Verify Windy City Elite advanced as teamB
      const finalsReady = afterSF2.rounds[1].matches[0];
      expect(finalsReady.teamA?.name).toBe("Metro Hawks");
      expect(finalsReady.teamB?.name).toBe("Windy City Elite");
    });
  });
});

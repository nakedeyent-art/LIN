import { describe, expect, it } from "vitest";
import {
  validateTeamInputs,
  validateScoreInputs,
  type TeamInput,
} from "./tournament-brackets";

describe("Tournament Brackets Domain Validation", () => {
  describe("validateTeamInputs", () => {
    it("accepts valid 4-team seeding", () => {
      const teams: TeamInput[] = [
        { name: "Hawks Elite", seed: 1, city: "Atlanta" },
        { name: "Bay Area Titans", seed: 2, city: "Oakland" },
        { name: "Windy City United", seed: 3, city: "Chicago" },
        { name: "Lone Star Rebels", seed: 4, city: "Dallas" },
      ];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(true);
    });

    it("accepts valid 8-team seeding", () => {
      const teams: TeamInput[] = [
        { name: "Team 1", seed: 1 },
        { name: "Team 2", seed: 2 },
        { name: "Team 3", seed: 3 },
        { name: "Team 4", seed: 4 },
        { name: "Team 5", seed: 5 },
        { name: "Team 6", seed: 6 },
        { name: "Team 7", seed: 7 },
        { name: "Team 8", seed: 8 },
      ];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(true);
    });

    it("rejects fewer than 2 teams", () => {
      const teams: TeamInput[] = [{ name: "Lone Team", seed: 1 }];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/between 2 and 32/);
      }
    });

    it("rejects duplicate seeds", () => {
      const teams: TeamInput[] = [
        { name: "Team Alpha", seed: 1 },
        { name: "Team Beta", seed: 1 },
      ];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/duplicate seed/i);
      }
    });

    it("rejects seeds out of range (e.g. seed 5 in a 4-team bracket)", () => {
      const teams: TeamInput[] = [
        { name: "Team 1", seed: 1 },
        { name: "Team 2", seed: 2 },
        { name: "Team 3", seed: 3 },
        { name: "Team 4", seed: 5 },
      ];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/must be an integer between 1 and 4/i);
      }
    });

    it("rejects blank or invalid team names", () => {
      const teams: TeamInput[] = [
        { name: " ", seed: 1 },
        { name: "Valid Team", seed: 2 },
      ];
      const res = validateTeamInputs(teams);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/between 2 and 120/);
      }
    });
  });

  describe("validateScoreInputs", () => {
    it("accepts valid non-negative integer scores", () => {
      expect(validateScoreInputs(78, 72, true).valid).toBe(true);
      expect(validateScoreInputs(0, 0, false).valid).toBe(true);
      expect(validateScoreInputs(104, 99, true).valid).toBe(true);
    });

    it("rejects negative scores", () => {
      const res = validateScoreInputs(-1, 50, true);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/between 0 and 999/);
      }
    });

    it("rejects non-integer scores", () => {
      const res = validateScoreInputs(50.5, 50, false);
      expect(res.valid).toBe(false);
    });

    it("rejects scores exceeding 999", () => {
      const res = validateScoreInputs(1000, 95, false);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/between 0 and 999/);
      }
    });

    it("rejects ties when a game is marked final", () => {
      const res = validateScoreInputs(80, 80, true);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.error).toMatch(/ties are not allowed/i);
      }
    });

    it("allows ties during live/in-progress games", () => {
      const res = validateScoreInputs(45, 45, false);
      expect(res.valid).toBe(true);
    });
  });
});

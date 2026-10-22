import { describe, expect, it } from "vitest";
import {
  filterClipsBySkill,
  formatTimestamp,
  generateRecruiterShareToken,
  isShareTokenValid,
  parseTimestamp,
  type VideoClip,
} from "./video-vault";

describe("Film & Video Highlight Vault", () => {
  describe("Timestamp Conversion", () => {
    it("formats seconds to mm:ss correctly", () => {
      expect(formatTimestamp(75)).toBe("01:15");
      expect(formatTimestamp(0)).toBe("00:00");
      expect(formatTimestamp(245)).toBe("04:05");
    });

    it("parses mm:ss to seconds correctly", () => {
      expect(parseTimestamp("01:15")).toBe(75);
      expect(parseTimestamp("00:00")).toBe(0);
      expect(parseTimestamp("04:05")).toBe(245);
    });
  });

  describe("Clip Filtering by Skill Tags", () => {
    const clips: VideoClip[] = [
      {
        id: "c1",
        timestamp: "00:45",
        seconds: 45,
        title: "P&R Pocket Pass",
        skillCategory: "Playmaking & Passing",
        description: "Hit rolling big between two dropping defenders",
      },
      {
        id: "c2",
        timestamp: "01:20",
        seconds: 80,
        title: "Stepback 3PT",
        skillCategory: "Shooting & Shot Creation",
        description: "Created 3ft of space off right-to-left crossover",
      },
      {
        id: "c3",
        timestamp: "02:10",
        seconds: 130,
        title: "Transition Chase-down Block",
        skillCategory: "On-Ball Defense",
        description: "Pinned layup off backboard in fastbreak",
      },
    ];

    it("returns all clips when skill filter is 'All Skills' or undefined", () => {
      expect(filterClipsBySkill(clips, "All Skills").length).toBe(3);
      expect(filterClipsBySkill(clips, undefined).length).toBe(3);
    });

    it("filters clips precisely by designated skill tag", () => {
      const filtered = filterClipsBySkill(clips, "Playmaking & Passing");
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe("P&R Pocket Pass");
    });
  });

  describe("Recruiter Share Tokens", () => {
    it("generates a valid, verifiable recruiter deep-link token", () => {
      const token = generateRecruiterShareToken("ath-12345678", "reel-87654321", 30);
      expect(token).toMatch(/^nil_film_/);
      expect(isShareTokenValid(token)).toBe(true);
    });

    it("invalidates malformed or non-film tokens", () => {
      expect(isShareTokenValid("invalid_token")).toBe(false);
      expect(isShareTokenValid("nil_film_bad_payload")).toBe(false);
    });
  });
});

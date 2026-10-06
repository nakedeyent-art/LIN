import { describe, expect, it } from "vitest";
import { embedHeight, linkFromStored, parseMusicLink } from "./music";

const ID = "4uLU6hMCjMI75M1A2tKUQC";
const ok = (s: string) => { const r = parseMusicLink(s); if ("error" in r) throw new Error(r.error); return r; };
describe("parseMusicLink — Spotify", () => {
  it("accepts share links, intl links and URIs, rebuilding the URLs itself", () => {
    for (const s of [`https://open.spotify.com/track/${ID}`, `https://open.spotify.com/track/${ID}?si=abcdef123`, `https://open.spotify.com/intl-fr/track/${ID}`, `spotify:track:${ID}`, `  https://open.spotify.com/track/${ID}  `]) {
      const r = ok(s);
      expect(r).toMatchObject({ provider: "spotify", kind: "track", id: ID, canonicalUrl: `https://open.spotify.com/track/${ID}`, embedUrl: `https://open.spotify.com/embed/track/${ID}` });
    }
    expect(ok(`https://open.spotify.com/playlist/${ID}`).kind).toBe("playlist");
  });
  it("rejects look-alikes and junk", () => {
    for (const s of [`https://open.spotify.com.evil.com/track/${ID}`, `https://evil.com/open.spotify.com/track/${ID}`, `http://open.spotify.com/track/${ID}`, `https://user:pw@open.spotify.com/track/${ID}`,
      `https://open.spotify.com:8443/track/${ID}`, `javascript:alert(1)`, `https://open.spotify.com/track/short`, `https://open.spotify.com/user/${ID}`, `https://open.spotify.com/track/${ID}/extra`,
      `https://open.spotify.com/track/${ID.slice(0, 21)}"`, `data:text/html,<script>`, "", "just words", "x".repeat(400)])
      expect("error" in parseMusicLink(s), s).toBe(true);
  });
  it("never lets query strings or fragments leak through", () => {
    const r = ok(`https://open.spotify.com/track/${ID}?si=1&x="><script>#frag`);
    expect(r.canonicalUrl).toBe(`https://open.spotify.com/track/${ID}`);
    expect(r.embedUrl).not.toMatch(/[?#"<>]/);
  });
});
describe("parseMusicLink — Apple Music", () => {
  it("accepts albums, songs, playlists and the ?i= track form", () => {
    expect(ok("https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378112")).toMatchObject({
      provider: "apple_music", kind: "album", canonicalUrl: "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378112", embedUrl: "https://embed.music.apple.com/us/album/blinding-lights/1499378108?i=1499378112" });
    expect(ok("https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb").kind).toBe("playlist");
    expect(ok("https://music.apple.com/gb/song/x/1499378112").kind).toBe("song");
  });
  it("keeps odd characters percent-encoded, never raw", () => {
    const r = ok("https://music.apple.com/us/album/<x>/1499378108");
    expect(r.canonicalUrl).toBe("https://music.apple.com/us/album/%3Cx%3E/1499378108");
  });
  it("rejects look-alikes and malformed paths", () => {
    for (const s of ["https://music.apple.com.evil.com/us/album/x/1499378108", "http://music.apple.com/us/album/x/1499378108", "https://music.apple.com/usa/album/x/1499378108", "https://music.apple.com/us/video/x/1499378108",
      "https://music.apple.com/us/album/x/abc", "https://music.apple.com/us/album/x/1499378108/more", "https://music.apple.com/us/album/x/1499378108?i=abc", "https://embed.music.apple.com/us/album/x/1499378108", "https://itunes.apple.com/us/album/x/1499378108"])
      expect("error" in parseMusicLink(s), s).toBe(true);
  });
});
describe("linkFromStored", () => {
  it("round-trips what parse produced", () => {
    for (const s of [`https://open.spotify.com/album/${ID}`, "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378112"]) {
      const r = ok(s); expect(linkFromStored(r.provider, r.kind, r.id)).toEqual(r);
    }
  });
  it("refuses tampered rows", () => {
    expect(linkFromStored("spotify", "track", "../../evil")).toBeNull();
    expect(linkFromStored("apple_music", "album", "us/x/1499378108?i=1&evil=1")).toBeNull();
    expect(linkFromStored("soundcloud", "track", ID)).toBeNull();
    expect(linkFromStored("spotify", "user", ID)).toBeNull();
  });
  it("picks a sensible player height", () => { expect(embedHeight(ok(`https://open.spotify.com/track/${ID}`))).toBe(152); expect(embedHeight(ok(`https://open.spotify.com/playlist/${ID}`))).toBe(352); });
});

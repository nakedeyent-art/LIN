import { describe, expect, it } from "vitest";
import { parseFeed } from "./feedparse";
import { isPrivateIp } from "./safefetch";

const NOW = new Date("2026-10-06T12:00:00Z");
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;
describe("parseFeed", () => {
  it("reads RSS items, strips markup, keeps recent ones", () => {
    const f = parseFeed(rss(`
      <item><title>Top 25 rankings released</title><link>https://ex.com/a</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Ohio &amp; Texas <b>rise</b></p>]]></description></item>
      <item><title>Too old</title><link>https://ex.com/old</link><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate></item>
      <item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item>
      <item><title>No date</title><link>https://ex.com/nd</link></item>`), NOW);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ url: "https://ex.com/a", title: "Top 25 rankings released", summary: "Ohio & Texas rise" });
  });
  it("reads Atom entries", () => {
    const f = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Senior day recap</title><link rel="alternate" href="https://ex.com/s"/><updated>2026-10-05T09:00:00Z</updated><summary>Seniors honoured</summary></entry></feed>`, NOW);
    expect(f).toEqual([{ url: "https://ex.com/s", title: "Senior day recap", summary: "Seniors honoured", publishedAt: new Date("2026-10-05T09:00:00Z") }]);
  });
  it("rejects non-feeds and survives hostile XML", () => {
    expect(() => parseFeed("<html><body>hi</body></html>", NOW)).toThrow();
    expect(() => parseFeed("not xml at all", NOW)).toThrow();
    const bomb = `<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]><rss><channel><item><title>&b;&b;&b;</title><link>https://ex.com/x</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
    const r = parseFeed(bomb, NOW);
    expect(r.length === 0 || r[0].title.length < 100).toBe(true);
  });
  it("caps the number of items", () => {
    const many = Array.from({ length: 80 }, (_, i) => `<item><title>Story number ${i}</title><link>https://ex.com/${i}</link><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate></item>`).join("");
    expect(parseFeed(rss(many), NOW)).toHaveLength(50);
  });
});
describe("isPrivateIp", () => {
  it("flags non-public addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1", "224.0.0.1", "not-an-ip"])
      expect(isPrivateIp(ip), ip).toBe(true);
  });
  it("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "172.32.0.1"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

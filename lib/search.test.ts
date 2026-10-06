import { describe, expect, it } from "vitest";
import { cleanQuery, excerpt, queryOk } from "./search";

describe("search helpers", () => {
  it("cleans and bounds queries", () => {
    expect(cleanQuery("  camp \n\t appearance \u0000 ")).toBe("camp appearance");
    expect(cleanQuery("x".repeat(500)).length).toBe(80);
    expect(queryOk("a")).toBe(false); expect(queryOk("ab")).toBe(true);
  });
  it("excerpts around the first match", () => {
    const body = "word ".repeat(60) + "needle " + "tail ".repeat(60);
    const e = excerpt(body, "needle");
    expect(e).toContain("needle"); expect(e.startsWith("…")).toBe(true); expect(e.length).toBeLessThan(180);
  });
  it("falls back to the start when nothing matches", () => expect(excerpt("hello world", "zzz")).toBe("hello world"));
  it("never emits markup of its own", () => expect(excerpt("<b>x</b> needle", "needle")).toBe("<b>x</b> needle"));
});

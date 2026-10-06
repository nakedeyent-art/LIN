import { describe, expect, it } from "vitest";
import { stripImage, stripJpeg, stripPng } from "./images";

const enc = (s: string) => new TextEncoder().encode(s);
const seg = (marker: number, payload: Uint8Array) => { const len = payload.length + 2; return Uint8Array.from([0xff, marker, len >> 8, len & 0xff, ...payload]); };
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(s);

const jpeg = cat(Uint8Array.from([0xff, 0xd8]), seg(0xe0, enc("JFIF\0")), seg(0xe1, enc("Exif\0\0GPSLatitude=40.7,GPSLongitude=-74.0")), seg(0xe1, enc("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>owner</x:xmpmeta>")),
  seg(0xfe, enc("camera comment")), seg(0xe2, enc("ICC_PROFILE\0")), seg(0xdb, enc("quant")), Uint8Array.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xff, 0x00, 0x12, 0x34, 0xff, 0xd9]));
describe("stripJpeg", () => {
  it("drops EXIF, XMP and comments but keeps what's needed to render", () => {
    const out = stripJpeg(jpeg)!;
    expect(out).not.toBeNull();
    for (const bad of ["GPSLatitude", "Exif", "xmpmeta", "camera comment"]) expect(has(out, bad), bad).toBe(false);
    for (const good of ["JFIF", "ICC_PROFILE", "quant"]) expect(has(out, good), good).toBe(true);
    expect(out.length).toBeLessThan(jpeg.length);
    expect(out[0]).toBe(0xff); expect(out[1]).toBe(0xd8); expect(out[out.length - 1]).toBe(0xd9);
  });
  it("leaves the image data untouched", () => {
    const out = stripJpeg(jpeg)!;
    expect(Array.from(out.slice(out.length - 12))).toEqual(Array.from(jpeg.slice(jpeg.length - 12)));
  });
  it("rejects malformed files", () => {
    expect(stripJpeg(enc("not a jpeg"))).toBeNull();
    expect(stripJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]))).toBeNull();   // segment longer than the file
    expect(stripJpeg(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });
});
const chunk = (type: string, data: Uint8Array) => cat(Uint8Array.from([data.length >>> 24, (data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255]), enc(type), data, Uint8Array.from([0, 0, 0, 0]));
const png = cat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", new Uint8Array(13)), chunk("tEXt", enc("Comment\0at home 40.7,-74.0")), chunk("eXIf", enc("GPS")), chunk("tIME", new Uint8Array(7)), chunk("IDAT", enc("pixels")), chunk("IEND", new Uint8Array()));
describe("stripPng", () => {
  it("drops text, EXIF and time chunks and keeps the image", () => {
    const out = stripPng(png)!;
    expect(out).not.toBeNull();
    for (const bad of ["tEXt", "at home", "eXIf", "tIME"]) expect(has(out, bad), bad).toBe(false);
    for (const good of ["IHDR", "IDAT", "pixels", "IEND"]) expect(has(out, good), good).toBe(true);
  });
  it("rejects malformed files", () => {
    expect(stripPng(enc("nope"))).toBeNull();
    expect(stripPng(png.slice(0, png.length - 12))).toBeNull();            // no IEND
    expect(stripPng(png.slice(0, 40))).toBeNull();                          // truncated chunk
  });
});
it("stripImage passes other types through untouched", () => { const b = enc("%PDF-1.7"); expect(stripImage("application/pdf", b)).toBe(b); });

import { describe, expect, it } from "vitest";
import { checkUploads, MAX_FILE_BYTES, safeFilename, sniff } from "./attachments";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7\n...");
describe("sniff", () => {
  it("recognises the three allowed types by their bytes", () => {
    expect(sniff(png)?.type).toBe("image/png"); expect(sniff(jpg)?.type).toBe("image/jpeg"); expect(sniff(pdf)?.type).toBe("application/pdf");
  });
  it("rejects everything else, whatever the name says", () => {
    for (const b of [new TextEncoder().encode("<html><script>alert(1)</script>"), new TextEncoder().encode("MZ\x90\x00"), new TextEncoder().encode("GIF89a"), new Uint8Array([]), new Uint8Array([0x89, 0x50])])
      expect(sniff(b)).toBeNull();
  });
});
describe("safeFilename", () => {
  it("strips paths, odd characters and the claimed extension", () => {
    expect(safeFilename("../../etc/passwd.exe", "png")).toBe("passwd.png");
    expect(safeFilename("C:\\Users\\me\\flyer.pdf.html", "pdf")).toBe("flyer.pdf.pdf");
    expect(safeFilename("<img onerror=x>.png", "png")).toBe("img onerrorx.png");
    expect(safeFilename("...", "jpg")).toBe("attachment.jpg");
    expect(safeFilename("a".repeat(300) + ".png", "png").length).toBeLessThanOrEqual(84);
  });
});
describe("checkUploads", () => {
  it("accepts valid files and renames by true type", () => {
    const r = checkUploads([{ name: "scan.exe", bytes: png }], 0);
    expect(r.ok && r.files[0]).toMatchObject({ filename: "scan.png", type: "image/png" });
  });
  it("enforces counts and sizes", () => {
    expect(checkUploads([1, 2, 3, 4].map(() => ({ name: "a.png", bytes: png })), 0).ok).toBe(false);
    expect(checkUploads([{ name: "a.png", bytes: png }], 20).ok).toBe(false);
    const big = new Uint8Array(MAX_FILE_BYTES + 1); big.set(png);
    expect(checkUploads([{ name: "a.png", bytes: big }], 0).ok).toBe(false);
    expect(checkUploads([{ name: "a.png", bytes: new Uint8Array() }], 0).ok).toBe(false);
  });
  it("rejects a disguised file", () => expect(checkUploads([{ name: "photo.png", bytes: new TextEncoder().encode("<svg onload=alert(1)>") }], 0).ok).toBe(false));
});

/** Pure attachment rules. Only PNG, JPEG and PDF; the file's own bytes decide the type, never the name or the browser's claim. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 3;
export const MAX_FILES_PER_DEAL = 20;
import { stripImage } from "./images";
export type Sniffed = { type: "image/png" | "image/jpeg" | "application/pdf"; ext: "png" | "jpg" | "pdf" };

export function sniff(b: Uint8Array): Sniffed | null {
  const starts = (sig: number[]) => b.length >= sig.length && sig.every((v, i) => b[i] === v);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: "image/png", ext: "png" };
  if (starts([0xff, 0xd8, 0xff])) return { type: "image/jpeg", ext: "jpg" };
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { type: "application/pdf", ext: "pdf" };
  return null;
}

/** Keeps a readable name but nothing that can mislead or traverse: letters, digits, space, dot, dash, underscore. */
export function safeFilename(name: string, ext: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^A-Za-z0-9 ._-]/g, "").replace(/\.{2,}/g, ".").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80);
  return `${base || "attachment"}.${ext}`;
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export type Upload = { name: string; bytes: Uint8Array };
export type Checked = { ok: true; files: { filename: string; type: Sniffed["type"]; bytes: Uint8Array }[] } | { ok: false; error: string };

export function checkUploads(files: Upload[], alreadyOnDeal: number): Checked {
  if (files.length > MAX_FILES_PER_MESSAGE) return { ok: false, error: `Attach up to ${MAX_FILES_PER_MESSAGE} files per message.` };
  if (alreadyOnDeal + files.length > MAX_FILES_PER_DEAL) return { ok: false, error: `This deal's conversation has reached its limit of ${MAX_FILES_PER_DEAL} attachments.` };
  const out: { filename: string; type: Sniffed["type"]; bytes: Uint8Array }[] = [];
  for (const f of files) {
    if (f.bytes.length === 0) return { ok: false, error: "One of the files is empty." };
    if (f.bytes.length > MAX_FILE_BYTES) return { ok: false, error: `Each file must be under ${formatBytes(MAX_FILE_BYTES)}.` };
    const s = sniff(f.bytes);
    if (!s) return { ok: false, error: "Only PNG, JPEG or PDF files can be attached." };
    // Photos carry hidden location/device data; strip it before storing (a damaged image is refused rather than stored as-is).
    const clean = stripImage(s.type, f.bytes);
    if (!clean) return { ok: false, error: "That image looks damaged. Try saving it again and re-attaching." };
    out.push({ filename: safeFilename(f.name, s.ext), type: s.type, bytes: clean });
  }
  return { ok: true, files: out };
}

/**
 * Removes metadata from user-uploaded images (EXIF/XMP, which can hold GPS coordinates and device details; PNG text/time chunks)
 * without re-encoding, so pixels are untouched. Returns null if the file is malformed.
 */
const KEEP_APP = new Set([0xe0, 0xe2, 0xee]);   // JFIF, ICC profile, Adobe colour transform (needed to render correctly)

export function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i + 1] === 0xff) i++;                         // fill bytes
    const m = b[i + 1];
    if (m === undefined) return null;
    if (m === 0xd9) { parts.push(b.subarray(i, i + 2)); return concat(parts); }          // EOI
    if (m === 0xda) { parts.push(b.subarray(i)); return concat(parts); }                // SOS: the rest is image data
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { parts.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > b.length) return null;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const drop = (m >= 0xe0 && m <= 0xef && !KEEP_APP.has(m)) || m === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;   // never reached an end marker
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const DROP_PNG = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);
export function stripPng(b: Uint8Array): Uint8Array | null {
  if (b.length < 8 || !PNG_SIG.every((v, i) => b[i] === v)) return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8, sawEnd = false;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (i + 12 + len > b.length) return null;
    if (!DROP_PNG.has(type)) parts.push(b.subarray(i, i + 12 + len));
    i += 12 + len;
    if (type === "IEND") { sawEnd = true; break; }
  }
  return sawEnd ? concat(parts) : null;
}

export function stripImage(type: string, b: Uint8Array): Uint8Array | null {
  return type === "image/jpeg" ? stripJpeg(b) : type === "image/png" ? stripPng(b) : b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Music links for a profile status. No account linking: the user pastes a Spotify or Apple Music link, we validate it strictly,
 * keep only the parsed parts, and rebuild the canonical and embed URLs ourselves — user input is never used as a URL.
 */
export type Provider = "spotify" | "apple_music";
export type MusicLink = { provider: Provider; kind: string; id: string; canonicalUrl: string; embedUrl: string };
export const PROVIDER_LABEL: Record<Provider, string> = { spotify: "Spotify", apple_music: "Apple Music" };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS = new Set(["track", "album", "playlist", "artist", "episode", "show"]);
const APPLE_KINDS = new Set(["album", "playlist", "song", "artist"]);
const APPLE_ID = /^(pl\.[A-Za-z0-9]+|\d{3,20})$/;
const SLUG = /^[\p{L}\p{N}%._~-]{1,100}$/u;
const STOREFRONT = /^[a-z]{2}$/;

export function parseMusicLink(raw: string): MusicLink | { error: string } {
  const input = raw.trim();
  if (!input) return { error: "Paste a Spotify or Apple Music link." };
  if (input.length > 300) return { error: "That link is too long." };

  const uri = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})$/.exec(input);
  if (uri) return spotify(uri[1], uri[2]);

  let u: URL;
  try { u = new URL(input); } catch { return { error: "That doesn't look like a link. Copy it from Spotify or Apple Music's Share menu." }; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return { error: "Use the https:// link from the Share menu." };

  if (u.hostname === "open.spotify.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("intl-")) parts.shift();       // open.spotify.com/intl-fr/track/…
    if (parts.length === 2 && SPOTIFY_KINDS.has(parts[0]) && SPOTIFY_ID.test(parts[1])) return spotify(parts[0], parts[1]);
    return { error: "That Spotify link isn't a song, album, playlist, artist or podcast." };
  }
  if (u.hostname === "music.apple.com") {
    const [cc, kind, slug, id, ...rest] = u.pathname.split("/").filter(Boolean);
    // /us/album/<slug>/<id>  ·  /us/playlist/<slug>/pl.<id>  ·  /us/song/<slug>/<id>  ·  /us/album/<id> (no slug)
    const noSlug = id === undefined && APPLE_ID.test(slug ?? "");
    const realSlug = noSlug ? "-" : slug, realId = noSlug ? slug : id;
    if (!STOREFRONT.test(cc ?? "") || !APPLE_KINDS.has(kind ?? "") || rest.length || !SLUG.test(realSlug ?? "") || !APPLE_ID.test(realId ?? ""))
      return { error: "That Apple Music link isn't a song, album, playlist or artist." };
    const track = u.searchParams.get("i");
    if (track !== null && !/^\d{3,20}$/.test(track)) return { error: "That Apple Music link has an odd track number." };
    const path = `/${cc}/${kind}/${realSlug}/${realId}`;
    const q = track ? `?i=${track}` : "";
    return { provider: "apple_music", kind, id: `${cc}/${realSlug}/${realId}${q}`, canonicalUrl: `https://music.apple.com${path}${q}`, embedUrl: `https://embed.music.apple.com${path}${q}` };
  }
  return { error: "Only Spotify (open.spotify.com) and Apple Music (music.apple.com) links are supported." };
}

const spotify = (kind: string, id: string): MusicLink =>
  ({ provider: "spotify", kind, id, canonicalUrl: `https://open.spotify.com/${kind}/${id}`, embedUrl: `https://open.spotify.com/embed/${kind}/${id}` });

/** Rebuilds links from stored parts only, so even a tampered database row can't inject a foreign URL. */
export function linkFromStored(provider: string, kind: string, id: string): MusicLink | null {
  if (provider === "spotify") return SPOTIFY_KINDS.has(kind) && SPOTIFY_ID.test(id) ? spotify(kind, id) : null;
  if (provider === "apple_music") {
    const m = /^([a-z]{2})\/([^/?]+)\/([^/?]+)(\?i=\d{3,20})?$/.exec(id);
    if (!m || !APPLE_KINDS.has(kind) || !SLUG.test(m[2]) || !APPLE_ID.test(m[3])) return null;
    const path = `/${m[1]}/${kind}/${m[2]}/${m[3]}${m[4] ?? ""}`;
    return { provider: "apple_music", kind, id, canonicalUrl: `https://music.apple.com${path}`, embedUrl: `https://embed.music.apple.com${path}` };
  }
  return null;
}
export const embedHeight = (l: MusicLink) => (l.provider === "spotify" ? (l.kind === "track" || l.kind === "episode" ? 152 : 352) : l.kind === "song" ? 175 : 450);

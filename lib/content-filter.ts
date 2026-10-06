/**
 * Automatic message screening. It blocks (never reads aloud to anyone): nothing is stored or shown to admins.
 * It's a speed bump, not a guarantee — determined people can evade it, so reporting and moderators back it up.
 *  - abuse / sexual content: every thread
 *  - off-platform payment talk: every thread while payments are on (keeps the fee and the escrow protection honest)
 *  - contact details & social handles: threads with a minor (adults may share contact details if they choose)
 */
export type FilterKind = "abuse" | "payment" | "contact";
export type FilterResult = { ok: true } | { ok: false; kind: FilterKind; error: string };

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
const squash = (t: string) => t.toLowerCase().replace(/[_.*\-]+/g, " ").replace(/[01345 7@$!]/g, (c) => LEET[c] ?? c).replace(/(.)\1{2,}/g, "$1").replace(/[^a-z\s]/g, "");

const joinSpaced = (t: string) => t.replace(/\b(?:[a-z]\s){2,}[a-z]\b/g, (m) => m.replace(/\s/g, ""));   // "f u c k" -> "fuck"
const ABUSE = /\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|cunt\w*|nigg\w*|fag\w*|retard\w*|slut\w*|whore\w*|kys|kill\s+yourself|i\s*(will|ll)\s+kill\s+you|nudes?|naked|sext\w*|onlyfans|horny)\b/;
const PAYMENT = /\b(venmo|cash\s?app|cashapp|zelle|paypal|apple\s?pay|bitcoin|crypto|western\s+union|wire\s+me|under\s+the\s+table|off\s*[- ]?\s*platform|outside\s+(of\s+)?(the\s+)?(app|platform|lin)|pay\s+me\s+(directly|outside|cash))\b/i;
const EMAIL = /[a-z0-9._%+-]+\s*(@|\(\s*at\s*\)|\[\s*at\s*\])\s*[a-z0-9-]+\s*(\.|\(\s*dot\s*\)|\[\s*dot\s*\])\s*[a-z]{2,}/i;
const PHONE = /(?:\+?\d[\s().\-]*){10,}/;
const URL = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|me|co|gg|ly|app|tv|link|us)\b/i;
const HANDLE = /(^|\s)@[a-z0-9_.]{3,}/i;
const SOCIAL = /\b(insta(gram)?|ig|snap(chat)?|whats\s?app|telegram|discord|tiktok|kik|signal|facetime|text\s+me|call\s+me|dm\s+me|my\s+(number|cell|phone|email|handle)|add\s+me)\b/i;

export function screenText(text: string, o: { minorThread: boolean; paymentsOn: boolean }): FilterResult {
  const q = squash(text);
  if (ABUSE.test(q) || ABUSE.test(joinSpaced(q))) return { ok: false, kind: "abuse", error: "That message looks abusive or inappropriate, so it wasn't sent. Please reword it." };
  if (o.paymentsOn && PAYMENT.test(text))
    return { ok: false, kind: "payment", error: "Payments for deals go through LIN so both sides are protected. Please don't arrange payment outside the platform." };
  if (o.minorThread && (EMAIL.test(text) || PHONE.test(text) || URL.test(text) || HANDLE.test(text) || SOCIAL.test(text)))
    return { ok: false, kind: "contact", error: "To keep young athletes safe, contact details, links and social handles can't be shared in this conversation. Their parent/guardian can arrange anything further." };
  return { ok: true };
}

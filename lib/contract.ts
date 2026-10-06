/** Pure contract + e-signature rules. The text is generated deterministically so its SHA-256 identifies it exactly. */
import { createHash } from "node:crypto";
import { formatBps } from "./money";
import { formatCents, isOpen, type Capacity, type DealStatus } from "./deals";

export const TEMPLATE_VERSION = "nil-v1";
export const ESIGN_CONSENT_VERSION = "esign-v1";
export const ESIGN_CONSENT_TEXT =
  "I agree to sign this agreement electronically and to receive it and related notices electronically. I understand my typed name is my legal " +
  "signature, that it has the same effect as a handwritten one, and that I can print or save a copy of this agreement at any time. " +
  "I have read the agreement above.";

export type ContractTerms = {
  dealId: string;
  title: string;
  amountCents: number;
  deliverables: string;
  sponsor: { name: string; roleLabel: string };
  athlete: { name: string; state: string | null; minor: boolean };
  platformFeeBps: number;
  paymentsEnabled: boolean;
  fmvAttested: boolean;
  createdOn: string; // YYYY-MM-DD (UTC)
};

export const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Deterministic: same terms in, byte-identical text (and hash) out. */
export function renderContract(t: ContractTerms): string {
  const money = formatCents(t.amountCents);
  const fee = t.platformFeeBps > 0
    ? `A platform fee of ${formatBps(t.platformFeeBps)} of the Compensation is deducted from the Athlete's payout; the Sponsor pays exactly ${money}.`
    : "No platform fee is deducted from the Compensation.";
  const paymentClause = t.paymentsEnabled
    ? `The Sponsor will fund ${money} through the LIN platform after both sides have signed. The funds are held by the platform's payment processor and are released to the Payee when the Sponsor confirms the Deliverables are complete. ${fee}`
    : `${money} is payable by the Sponsor to the ${t.athlete.minor ? "Athlete's Parent/Legal Guardian, for the Athlete's benefit," : "Athlete"} on the terms agreed between the parties. This Agreement does not itself move money.`;
  const lines = [
    "NAME, IMAGE AND LIKENESS (NIL) AGREEMENT",
    `Template ${TEMPLATE_VERSION} · Agreement ID ${t.dealId} · Prepared ${t.createdOn}`,
    "",
    "1. PARTIES",
    `Sponsor: ${t.sponsor.name} (${t.sponsor.roleLabel}).`,
    `Athlete: ${t.athlete.name}${t.athlete.minor ? ", a minor" : ""}.`,
    ...(t.athlete.minor ? [`Parent/Legal Guardian: the linked guardian who signs below on the Athlete's behalf and represents that they have legal authority to do so.`] : []),
    "",
    "2. DELIVERABLES",
    t.deliverables.trim(),
    "",
    "3. COMPENSATION",
    `Compensation is ${money} (USD) for the Deliverables. ${paymentClause}`,
    "",
    "4. TERM",
    "This Agreement begins when the last required party signs and ends when the Deliverables are complete and the Compensation has been paid, or when it is cancelled under section 7.",
    "",
    "5. COMPLIANCE",
    `${t.fmvAttested ? "The Sponsor confirmed when making the offer that " : "The parties confirm that "}the Compensation is for the Deliverables at fair market value and is not for enrollment, recruitment, or athletic performance.`,
    "The Athlete is responsible for following the rules of their school, athletic association and state, including any disclosure of this Agreement that those rules require.",
    "The Sponsor may use the Athlete's name, image and likeness only as needed for the Deliverables.",
    "",
    ...(t.athlete.minor ? ["6. MINOR ATHLETE", "The Parent/Legal Guardian signs on behalf of the Athlete, confirms they are the Athlete's parent or legal guardian, and accepts this Agreement for the Athlete. Any rules requiring additional approval for a minor's agreement (for example by a court or school) remain the parties' responsibility.", ""] : ["6. ADULT ATHLETE", "The Athlete confirms they are at least 18 years old.", ""]),
    "7. CANCELLATION",
    "Before the Compensation is funded, either side may cancel through the platform. After it is funded, the Agreement can be cancelled only if both sides agree through the platform, in which case the Sponsor is refunded.",
    "",
    "8. ELECTRONIC SIGNATURES",
    "The parties consent to sign and keep this Agreement electronically. Each typed-name signature below is recorded with the time of signing and the exact text signed (identified by the SHA-256 shown on the signature page).",
    "",
    "9. GENERAL",
    `This Agreement is the entire agreement about the Deliverables. It is governed by the laws of ${t.athlete.state ? `the State of ${t.athlete.state}` : "the Athlete's state of residence"}, to the extent permitted. If any part is unenforceable, the rest stays in effect.`,
  ];
  return lines.join("\n");
}

export type SigRole = "counterparty" | "athlete" | "guardian";

/** Executed = the sponsor AND the athlete's side (the adult athlete, or a guardian for a minor) have signed. */
export function executionState(roles: SigRole[]) {
  const buyer = roles.includes("counterparty");
  const athleteSide = roles.includes("athlete") || roles.includes("guardian");
  return { buyer, athleteSide, executed: buyer && athleteSide };
}

export type SignCheck = { ok: true; role: SigRole } | { ok: false; error: string };

export function canSign(i: { who: Capacity; athleteIsMinor: boolean; status: DealStatus; expired: boolean; voided: boolean; alreadySigned: boolean }): SignCheck {
  if (i.voided) return { ok: false, error: "This agreement was voided." };
  if (i.status !== "awaiting_signature" || !isOpen(i.status)) return { ok: false, error: "This deal isn't waiting for signatures." };
  if (i.expired) return { ok: false, error: "This agreement expired before it was signed." };
  if (i.alreadySigned) return { ok: false, error: "You've already signed this agreement." };
  if (i.who === "counterparty") return { ok: true, role: "counterparty" };
  if (i.who === "guardian") return i.athleteIsMinor ? { ok: true, role: "guardian" } : { ok: false, error: "Guardian signing no longer applies: the athlete is now an adult and signs for themself." };
  return i.athleteIsMinor ? { ok: false, error: "A minor can't sign; a linked parent/guardian signs on their behalf." } : { ok: true, role: "athlete" };
}

/** Signature name check: case-, spacing- and accent-insensitive match against the signer's account name. */
export const normalizeName = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const nameMatches = (typed: string, account: string) => normalizeName(typed).length >= 2 && normalizeName(typed) === normalizeName(account);

/** Plain-text export of an executed/pending agreement: the exact body, then the signature page. */
export function renderSignaturePage(sha: string, sigs: { role: SigRole; typedName: string; signedAt: string; consentVersion: string }[]): string {
  const label: Record<SigRole, string> = { counterparty: "Sponsor", athlete: "Athlete", guardian: "Parent/Legal Guardian (on behalf of the Athlete)" };
  return [
    "SIGNATURES",
    `Document SHA-256: ${sha}`,
    ...(sigs.length ? sigs.map((s) => `- ${label[s.role]}: ${s.typedName} — signed ${s.signedAt} (consent ${s.consentVersion})`) : ["- (no signatures yet)"]),
  ].join("\n");
}

# Security review and implementation record

Date: 2026-10-10. Repository `nakedeyent-art/LIN`, local branch `codex/security-and-app-improvements`. This is a code review and local test record, not a production audit or compliance certification.

## Addressed

- **MFA transition races and recovery bypass:** `lib/mfa.ts`, `lib/session.ts`, migration 017. Enrollment/disable and session revocation are transactional; live sessions are required. Support recovery forces re-enrollment before private app access. Recovery hashes work independently of encrypted TOTP seeds. Demotion preserves MFA.
- **Sensitive financial operations:** deal, contract, payment and admin server actions require recent MFA. `lib/payee.ts` locks deal/payment records and prohibits destination changes after a transfer attempt or settlement. Payout refresh is a protected POST action.
- **Lockout and offer limits:** expired lockouts reset the attempt budget; offer creation serializes the per-athlete/offerer limit and screens title/deliverable text.
- **News outbound requests:** `lib/safefetch.ts` pins a validated DNS address into the transport while retaining host/TLS identity, revalidates redirects, limits bytes/time, and rejects private destinations outside explicit local development mode.
- **New private files:** document, signing and scouting downloads require verified full authentication, deny unauthorized records and send no-store/nosniff headers. Document grants also require current athlete relationship and category consent.
- **Signing integrity:** pinned source versions, immutable evidence/artifacts, ordered recipients, single-use session tokens, current authority checks and transactional completion. Only the existing-contract bridge can activate a NIL deal. Source changes are rejected during live or completed signing.
- **Scouting privacy:** private evaluations stay author/explicit-organization scoped; family sharing is intentional. Blocking/discoverability are rechecked. Upload counts are serialized per report.
- **Retention:** new-domain account deletion removes or redacts unsigned private content and keeps signed transaction evidence. Exports include the user's operational records without exporting other authors' private evaluations.

## Remaining release work

1. Upload malware quarantine, aggregate quotas and object storage; Office text parsing and file signatures are not malware scanning.
2. Distributed abuse controls and recovery identity-verification procedure. TOTP remains susceptible to real-time phishing; passkeys are not implemented.
3. Transactional email/outbox reliability. Signing notices currently use in-app notifications; existing security emails are best effort.
4. Real provider test-mode verification for payment, webhook ordering and email delivery. Local tests do not establish live-provider behavior.
5. Concurrency review of relationship/organization revocation versus all new writes; browser tests do not exhaust interleavings.
6. Organization ownership lifecycle, batch-job fairness at scale, full legacy-suite portability, and an independent accessibility/privacy review of the expanded UI.

## Evidence and limits

The unit, database integration, MFA, settings and operations suites plus production compilation are listed with exact latest counts in `docs/GEMINI_REVIEW_HANDOFF.md`. No live deployment, production accounts, payment settlement or external email delivery were exercised. The inaccessible Claude session was not reviewed. See that handoff for Gemini's review status and reproducible follow-up instructions.

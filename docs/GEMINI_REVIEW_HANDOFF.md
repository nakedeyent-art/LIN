# Gemini review handoff — NIL / LIN

Status: local implementation ready for independent review. The continuation is being committed for branch transfer; it is not deployed or approved for production. Read `OPERATIONS_IMPLEMENTATION.md` for the implemented scope and explicit remaining work.

## Source and scope

- Repository: nakedeyent-art/LIN.
- Original source branch confirmed by the owner: `claude/sleepy-bohr-us0ind`.
- Starting commit: `2babd80ac36b8accf805d6f4e5dcfaab0098763f`.
- Local implementation branch: `codex/security-and-app-improvements`.
- Workspace: `/Users/rizzolini/Documents/ChatGPT/NIL`.
- Claude conversation supplied: https://claude.ai/code/session_01SRikBnTjQH1T7TtZvs1FAG . It could not be retrieved; do not claim to have read it.
- Local Forg3 reference: sibling `Forg3-Labe1-Integration`, an original domain package, not a live signing service.

## Requested review

Review the actual changes and application, not just this document. Find bugs, glitches, missing functionality, authorization regressions, inaccessible or confusing interactions, and opportunities to improve the design and experience. Give each finding severity, exact file/line, a reproducible example, expected versus actual behavior, and a concrete repair. Distinguish verified failures from hypotheses. Preserve all existing uncommitted work. Do not push, deploy, alter real accounts, or contact users.

Do not read or transmit secrets, `.env*`, account credentials, or browser profiles. `.test-output` contains disposable test artifacts and mail tokens; use only relevant test summaries/screenshots. Tests that truncate tables must target a disposable local database ending in `_e2e`, and must run sequentially.

## Product requirements to check independently

1. Athlete workspace: overview, schedule, recruiting, deals, documents, development, team, activity. Actionable overview and consent-aware rollups.
2. Documents: PDF/Office uploads, folders/tags, previews, immutable versions, all requested categories, expiration, relationship/category access, search by athlete/type/deal/event/uploader/status/date, immutable completed agreements.
3. Forg3: upload/generated agreements, five field types, six recipient capacities, ordering, reminders/expiry, complete state machine, completed PDF and audit certificate, athlete/deal linkage.
4. Deal workspace: parties, deliverables, messages, agreement, funding/payout, performance evidence, deadlines, compliance and audit.
5. Sports operations: seasons/tournaments, events, venues, real routes and stops, transport/hotel/contact information, availability/attendance/consent, tasks, expenses, conflict/turnaround warnings.
6. Scouting: private/organization reports, configurable stages and templates, observations, film/media, measurables/verification, consented academics, comparison, follow-ups, activity and watchlists.
7. UI: original restrained dark style, compact navigation, dense tables, record tabs and right activity rail; mobile prioritizes today and actions.
8. Shared athlete, organization and event identifiers throughout. External maps and sports data only after the internal model is stable.

## Review hotspots

- All pages/actions/files must reject sessions pending MFA; new routes must not widen admin or relationship access.
- Guardian authority must disappear at 18/revocation. Organization membership must never imply academic/medical/tax access.
- Signing must pin content, freeze configuration, reject replay/order bypass and stale recipient authority, and atomically produce evidence/artifacts.
- Only the generated frozen contract workflow may activate a NIL deal. Arbitrary uploaded agreements must not bypass the payment state machine.
- Concurrent file versions/envelopes and partial signing versus cancellation must not leave inconsistent state.
- File validation, PDF scripts/forms, Office binary formats, body/storage limits and malicious content handling need adversarial review.
- Non-ASCII names and long legal text must render faithfully. A PDF audit certificate is not a PKI digital signature or a legal compliance certification.
- Erasure must delete unsigned private content while retaining signed transaction evidence; foreign keys must not break account deletion.
- Activity, reminders, exports and search must not reveal private evaluations, locations, health or identity details.
- Forms need accessible labels, validation, actionable errors, usable field placement and reliable mobile navigation.

## Verification evidence

Verification on the disposable local PostgreSQL database:

| Check | Latest result |
| --- | --- |
| Unit tests | 257/257, 30 files |
| Database integration | 58/58, including transactional document-authority recheck |
| Ordinary MFA (e2e18) | 88/88 |
| Admin MFA (e2e17) | 73/73 |
| Settings/deletion (e2e6) | 83/83; both historical assertion errors corrected |
| Operations (e2e19) | 14/14: eight tabs, unauthorized access, upload, no-cache download, ordered signing, MFA gate, completed PDF/certificate, schedule, route, mobile width, no browser errors |
| Production build | Passed after final PDF/permission refinements; exit 0 |
| Dependency audit | Production dependencies: zero known advisories in the recorded audit |

The latest browser run preceded the final PDF wrapping and transactional document-authority refinements; dedicated unit/integration checks cover those refinements. Other legacy browser suites were not rerun on this branch. No real Stripe settlement, production email delivery or production deployment was tested.

Tests exposed a PDF wrapping performance regression: repeatedly measuring growing strings caused timeouts. Word-based wrapping with cached measurements replaced that implementation; the added multilingual pagination and invalid-field tests now pass. No timeout was increased to conceal the issue.

Local evidence: `.test-output/unit.log`, `integration.log`, `build.log`, `e2e17.log`, `e2e18.log`, `e2e6.log`, `e2e19.log`. Logs are ignored by Git and may not accompany this handoff; rerun using `e2e/README.md`. Do not inspect development mail tokens.

## Gemini review execution

A read-only Gemini CLI review was attempted with plan approval mode and extensions disabled, including a retry with standard input closed. Both attempts remained running without producing findings; they were stopped. The tool emitted terminal/ripgrep warnings but no diagnostic identifying the cause. No independent Gemini review or approval is claimed. This packet is ready to open in Gemini. Findings should be saved as a separate review, with no edits or deployment during the initial review.

## Important remaining work

- Faithful Office conversion and drag-and-drop signing fields; current previews extract text and placement uses coordinates.
- Malware quarantine, aggregate storage quotas and object storage.
- Reliable email notices/outbox; current signing reminders are in-app.
- Organization ownership transfer/archival, organization-wide record permissions, revocation concurrency across every new mutation.
- Multi-athlete event editing, richer event-linked scouting and complete mobile/keyboard/screen-reader acceptance.
- Fair pagination/retries for reminder/watchlist jobs at scale.
- Real road-routing/travel-time and sports-data providers; current map is an opt-in stop-sequence display.
- Independent legal/eligibility/provider validation and full legacy regression portability.

See `OPERATIONS_IMPLEMENTATION.md` and `../security_best_practices_report.md` for detail. Report these product gaps separately from reproducible defects in delivered behavior.

## Paste into Gemini

> Review the NIL repository at `/Users/rizzolini/Documents/ChatGPT/NIL`, on `codex/security-and-app-improvements`. Read `docs/GEMINI_REVIEW_HANDOFF.md` and inspect both tracked changes and untracked source files. Find reproducible bugs, authorization and signing failures, missing workflows, accessibility problems and design/experience improvements. Start read-only. Preserve the working tree; do not read secrets, environment files, browser profiles or test mail tokens. For every finding provide severity, file/line, reproduction, expected versus actual behavior, and suggested repair. Separate verified defects from hypotheses and feature gaps. Run destructive tests only against a disposable local `_e2e` database, sequentially. Do not deploy, push or contact users.

## Status update (Claude continuation, migrations 030–036)

Branch `codex/security-and-app-improvements`. Every item below is on the branch with tests; nothing is deployed, and no pull request was opened.

### Product decisions taken by the user (2026-10-11)
- **Events belong to their organizer.** Only the organizer edits, cancels or changes the attendee list. Families keep attendance and guardian consent for their own athlete. An organizer who is no longer a guardian keeps control of the event but can no longer share it with recruiters or add that athlete.
- **Recent MFA (10 minutes) is required** to begin and finish signing *and* to create, send, void or decline an agreement, and to generate a deal agreement. This confirms and extends the Codex default; it is no longer an open question.
- **Event times belong to the venue.** Each event stores an IANA time zone; forms take venue wall-clock time; the schedule shows venue time with a per-event "Show in my time zone" toggle (viewer's browser zone).

### Implemented on this branch
- Organization lifecycle (invite expiry/re-invite/revoke, leave, co-owners, archive, safe sole-owner deletion). Archived organizations grant nothing anywhere (scouting reports, attachments, seasons included).
- Email outbox with retry/backoff/dedupe for every notice; signing notices enqueue in the signing transaction. Fixed: a same-day second signature or completion notice is no longer swallowed by dedupe.
- Fair, progress-making reminder/watchlist jobs; new `upload-scan` job.
- Uploads: ClamAV INSTREAM adapter (fail closed); per-athlete/recruiter quotas; **private object storage** (S3-compatible, SigV4, server-side only; `OBJECT_STORAGE_*`), and **quarantine** (`UPLOAD_SCAN_MODE=async`: `document_versions.scan_status` pending → clean/infected; pending or infected files are never downloadable, previewable or signable; infected files notify the family; the verdict is immutable).
- Deal/signing integrity: voiding a deal voids its live envelope; stale guardian/athlete recipients are re-issued; one live envelope per contract; consistent deal→envelope lock order with a deadlock retry; legacy `contract_signatures.signed_pdf_sha256` records the hash of the PDF that was actually signed; a minor cannot start a deal agreement; money is never released while a card dispute is open; Stripe reconcile no longer holds a row lock across the network call.
- **Visual signing-field placement**: pages rendered with pdf.js, click to place and drag to size; numeric inputs remain for keyboard/screen-reader users.
- Events: edit/cancel, guardian consent give/withdraw (moving an event clears consent and notifies the family), multi-athlete attendance (add/remove with authority checks), saved-venue reuse, venue time zones.
- Scouting: observations can be linked to events the family shared with recruiters (name and date only).
- **Travel stops** carry contacts, linked documents (never identity/tax), tasks and expenses (migration 035); contacts are erased with the account and included in the data export.
- **Passkeys (WebAuthn)** as an additional second factor (migration 036): added in Settings behind a fresh authenticator code; usable at `/mfa/verify`; counter regression is refused; removing the last passkey never weakens MFA; turning MFA off, an admin reset or account deletion forgets every passkey. Covered end to end with Chromium's virtual authenticator (`npm run test:e2e:passkeys`).
- Rate limits (login/signup/reset/MFA) with `TRUST_PROXY`; complete personal data export; document sharing only to approved team members; accessibility fixes (alert roles, named buttons).

### Verified (disposable local database only)
Typecheck clean; unit 278; integration 143 (18 files); browser: e2e6 (83), e2e17 (73), e2e18 (88), e2e19 (24, connected operations/signing/schedule/travel), e2e21 (11, passkeys). See the report in the final session summary for e2e20 and the production build.

### Not done / not verified
- Office→PDF conversion for signing (PDF only); recruiter-facing scouting comparison/metrics UI beyond what exists.
- Real Stripe test-mode settlement and a real email provider were **not** exercised (mock Stripe and local mail only); no deployment.
- Object storage was tested against an in-process S3 stand-in, not a real bucket. Quarantine was tested against a clamd stand-in speaking the real INSTREAM protocol, not a real ClamAV.
- **No independent Gemini review has happened.** A separate Claude read-only review was run; its confirmed findings were fixed (above). Gemini cannot be run from the cloud session; `docs/GEMINI_REVIEW_HANDOFF.md` is ready to paste.

### Legacy browser suites (ported and re-run on this branch)
All legacy suites now run through `e2e/runtime.mjs` (disposable `*_e2e` database, local mail log, `E2E_BASE_URL`); the old sandbox paths are gone. Results on this branch: e2e1 ✓, e2e2 ✓ (log-style), e2e3 ✓, e2e4 ✓ (100), e2e5 ✓ (33), e2e7 ✓ (88), e2e8 ✓ (phase 1: 32, phase 2: 9), e2e9 ✓ (120), e2e10 ✓ (9), e2e11 ✓ (12), e2e12 ✓ (47), e2e13 ✓ (72), e2e14 ✓ (103), e2e15 ✓ (57), e2e16 ✓ (118).
How to run them: start the app with `node e2e/start-local.mjs` (payments suites e2e9/e2e11: `node scripts/mock-stripe.mjs` plus `E2E_PAYMENTS=1 E2E_STRIPE_WEBHOOK_SECRET=whsec_test_mock_secret_0123456789 E2E_PLATFORM_FEE_BPS=500`; e2e8 phase 2: `E2E_RESEND_API_KEY=<any invalid key>`), then `node e2e/<suite>.mjs`.

**The e2e4 mystery, resolved:** its three historical failures were stale expectations, not defects. Stat tiles render the value before the label (`105 Verified study minutes (7d)`, `0 Open offers`); the regexes expected label-then-value.

**Behaviour changes the legacy suites surfaced (all deliberate, tests updated):**
- Deal agreements are signed through Forg3, in recipient order (sponsor, then the athlete side); the typed-name legacy form only remains for contracts that already carry a legacy signature. Legacy `contract_signatures` rows are written at completion and now carry the signed-PDF hash.
- Approving, completing, cancelling, signing and funding need a recent second factor; the suites enrol MFA and refresh it (`e2e/mfa-helper.mjs`).
- Per-IP rate limits (login 40/10 min, reset 10/h, signup 8/h) accumulate across back-to-back suites; each suite now clears `rate_limits` with its fixtures.
- Booleans concatenated in SQL print `true`/`false`, not `t`/`f`.

**Product bugs found by the legacy suites and fixed:**
- The message content filter was applied verbatim to deal terms, so "Two Instagram posts" was refused for any minor's deal. Deal titles, deliverables and work items now allow platform names while still blocking contact details, links and handles (`platformsOk`).
- Deal actions and agreement generation asked for a second factor before checking standing, so an unauthorised sponsor (or a minor athlete) was sent to MFA set-up instead of being refused. Standing is now checked first.

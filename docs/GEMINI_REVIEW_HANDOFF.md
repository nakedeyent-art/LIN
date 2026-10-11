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

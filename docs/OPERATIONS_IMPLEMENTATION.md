# Connected athlete operations — implementation and limits

Local implementation on `codex/security-and-app-improvements`, based on `nakedeyent-art/LIN` branch `claude/sleepy-bohr-us0ind`, starting commit `2babd80`. Not deployed. The supplied Claude session could not be retrieved; repository code and the user's requirements are the sources for this work.

## Connected records delivered

| Area | Implemented |
| --- | --- |
| Athlete workspace | Eight tabs: Overview, Schedule, Recruiting, Deals, Documents, Development, Team, Activity. Consent-aware rollups, upcoming events, expiring documents, deal actions and development information. |
| Document center | PDF and Office uploads, nine categories, folders/tags, metadata filters, authenticated downloads, PDF preview, bounded Office XML text preview, immutable versions, expiry, explicit grants checked against current relationship/category permissions. |
| Forg3 | Persistent envelopes, recipients and ordered signing; signature, initials, date, checkbox and text fields; authenticated short-lived signing sessions; draft/sent/viewed/partially signed/completed/declined/expired/voided states; immutable evidence, completed PDF and audit certificate. |
| Deal operations | Record tabs for overview, deliverables, parties, messages, agreement, funding, compliance and activity. Buyer checklists, existing message-attachment performance evidence, review/request-changes actions and deadlines. Generated Forg3 agreements bridge into the existing contract/payment state machine. |
| Sports operations | Seasons, tournaments, events, venue coordinates, attendance/availability, guardian consent, routes and ordered stops, transport/hotel/contact details, linked tasks/documents/expenses and timing warnings. Optional map shows stop sequence. |
| Scouting | Private reports, explicit organization sharing, intentionally shared family reports, stages, sport-specific evaluation templates, film/media, attributed metrics with independent coach verification, comparisons, follow-ups and opt-in profile/showcase change alerts. |
| Daily operations | Today view, operational tasks, expense/reimbursement records, organization invitations, daily in-app reminders, activity history and mobile action navigation. |

## Identity and authorization

- Athlete IDs reference retained `users.id`, joined to athlete profiles for current permissions. This supports account anonymization while preserving signed transaction evidence. Deals and events use the existing shared domain IDs.
- Organization IDs are explicit and optional for personal records. Membership never independently grants access to athlete health, academic, identity or tax documents. Some creation forms currently create personal records only.
- Family permissions use current `guardian_links`; guardian authority ends at adulthood or revocation. Recruiter access also checks discoverability and blocking.
- Private evaluations are excluded from athlete-facing views unless deliberately shared by their author.
- Signing pins a document version and freezes recipients/fields at send. Only the generated legacy-contract bridge can execute an existing NIL contract; an arbitrary uploaded agreement cannot activate a deal or release money.
- New file routes require verified, fully authenticated sessions. MFA-pending sessions receive 401; unauthorized records return 404.

## Operational limits and follow-on work

This is a substantial local implementation, not a claim of complete production readiness.

- Office previews show extracted text, not faithful page layout. Legacy binary Office files download only. Field placement uses page/percentage coordinates; a drag-and-drop editor is not built.
- Signing reminders and expiry notices are in-app. Reliable email delivery, transactional outbox/retry visibility and external signing-provider integration remain to be built. The sibling Forg3 reference is an in-memory domain package, not a deployed provider.
- Uploaded files are held in Postgres with per-file limits. Malware quarantine/scanning, aggregate storage quotas and external object storage are not built. PDF evidence is immutable and hashed, not a PKI digital signature or a legal compliance certification.
- Route maps are opt-in OpenStreetMap/Leaflet displays with straight connecting lines. They do not calculate road directions, travel times or live sports data. External providers remain deferred.
- Expenses record reimbursement state but do not issue payouts. Deliverable acceptance does not automatically release funds or amend signed terms.
- Event records support multiple attendees in the schema; the current creation UI focuses on one athlete. Scouting observations have dates but do not yet expose every event linkage in the editor.
- Organization ownership transfer/archival and complete organization-wide operations permissions need further work. Do not delete a sole organization owner without arranging ownership management.
- Reminder/watchlist jobs use bounded batches; pagination/fairness at larger volumes and delivery retries need further work.
- Provider test-mode verification, specialist contract/eligibility review and the remaining legacy browser suites are separate release work.

See `GEMINI_REVIEW_HANDOFF.md` for independent review instructions and `../security_best_practices_report.md` for security changes and verification limits.

## Status update (Claude continuation, migrations 030-033)

Done and covered by tests (unit 269, integration 116, browser e2e19 18 checks, 3/3 stable runs):
- Organization lifecycle (invite expiry/re-invite/revoke, leave, role changes never leave zero owners, archive, sole-owner account deletion promotes or archives).
- Email outbox with retry/backoff/dedupe; all notices go through it; signing notices enqueue in the signing transaction. Admin shows delivery stats.
- Fair, progress-making reminder/watchlist jobs with per-item failure isolation.
- Upload hardening: ClamAV INSTREAM adapter (fail closed), per-athlete and per-recruiter quotas, version/document caps.
- Deal/signing integrity: voiding a deal voids its live envelope; stale guardian/athlete recipients are re-issued; one live envelope per contract.
- Data export, DB-backed rate limiting (login/reset/MFA) with TRUST_PROXY handling.
- Event edit/cancel and guardian consent give/withdraw; moving an event clears consent and notifies the family.

NOT done / not verified:
- Visual signing field placement, accessible preview, Office conversion; private object storage and quarantine states.
- Multi-athlete attendance editor, venue reuse, stop linkage to contacts/documents/tasks/expenses.
- Scouting UI completeness; passkeys; real Stripe test mode and real email provider (all mocked).
- Recent-MFA (10 min) for money/signing is a Codex default and still needs explicit product review.
- Suites other than e2e19/e2e20 and the vitest suites were not re-run after these changes; e2e4 failures remain unexplained.
- Nothing deployed. No independent Gemini review has happened (Gemini cannot be run from the cloud session).

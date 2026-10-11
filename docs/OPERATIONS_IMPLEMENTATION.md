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
- The remaining legacy browser suites (e2e1–e2e5, e2e7–e2e16) were not re-run on this branch; e2e4's earlier failures remain unexplained.
- Object storage was tested against an in-process S3 stand-in, not a real bucket. Quarantine was tested against a clamd stand-in speaking the real INSTREAM protocol, not a real ClamAV.
- **No independent Gemini review has happened.** A separate Claude read-only review was run; its confirmed findings were fixed (above). Gemini cannot be run from the cloud session; `docs/GEMINI_REVIEW_HANDOFF.md` is ready to paste.

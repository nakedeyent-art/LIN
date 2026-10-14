# Claude continuation handoff — NIL / LIN

Prepared 2026-10-10. This is a development continuation handoff, not a production-release declaration.

## 1. Start here: continuation branch and transfer

- Repository: `https://github.com/nakedeyent-art/LIN`.
- Original branch confirmed by the user: `claude/sleepy-bohr-us0ind`.
- Starting commit: `2babd80ac36b8accf805d6f4e5dcfaab0098763f`.
- Current local branch: `codex/security-and-app-improvements`.
- Local workspace: `/Users/rizzolini/Documents/ChatGPT/NIL`.
- **The continuation code and this handoff are being committed together for transfer on `codex/security-and-app-improvements`. Fetch that branch, not just `claude/sleepy-bohr-us0ind`. Confirm it contains migrations through 029 and this handoff before continuing. The original branch does not contain these changes.**
- No PR was opened and nothing was deployed. Preserve any local changes when checking out or integrating the continuation branch. Do not reset, clean, overwrite or discard work.
- The user supplied this original Claude session: `https://claude.ai/code/session_01SRikBnTjQH1T7TtZvs1FAG`. Codex could not retrieve its conversation. Use it if you can access it, but the actual current code and this handoff establish where development stopped.
- A source snapshot ZIP accompanies this handoff for use in a different environment. It contains current source, including new files, but no Git history, dependencies, environment credentials, database contents or test mail logs. Extract into a separate directory first. Compare against the baseline before integrating; do not overwrite another working tree blindly.
- If you cannot fetch the continuation branch and have neither the local folder nor the source snapshot, obtain the code before continuing. This document alone cannot reproduce the changes.

## 2. User intent and original requirements

Continue building and improving the app; do not stop at a review or proposal. Preserve existing MFA, messaging, payments, guardian protections and other working features. Find additional high-value improvements. After implementation, prepare an independent Gemini review for bugs, glitches, missing functionality, design and experience.

The user requested these connected modules:

1. **Athlete Operations Record:** Overview, Schedule, Recruiting, Deals, Documents, Development, Team, Activity. Overview should prioritize upcoming games, unsigned documents, deal deliverables, eligibility, recruiter activity and guardian actions.
2. **NIL Document Center:** PDF/Office uploads; athlete folders/tags; preview/version history; eligibility, identity, tax, medical, travel, contracts, media releases and school-compliance categories; expiry; relationship/category permissions; search by athlete/type/deal/game/uploader/status/date; immutable completed agreements.
3. **Forg3 signing:** uploaded/generated agreements; signatures, initials, dates, checkboxes and text; athlete/sponsor/guardian/agent/school/internal recipients; order; reminders/expiry; draft/sent/viewed/partially signed/completed/declined/expired/voided; completed PDF and audit certificate; athlete/deal linkage.
4. **Game/travel operations:** seasons/tournaments, games/camps/combines/showcases/visits, venues, departure/arrival, hotel/flight/bus/ground transport, maps, availability/attendance, documents/guardian consent, event tasks, expenses/reimbursements and conflict/turnaround warnings. Routes and stops must be real records linked to other domains.
5. **Scouting:** prospect pipelines/templates, event observations, attributed notes, film/media, measurables/verified statistics, consented academic/eligibility information, comparisons, follow-ups, recruiter history and profile/showcase watchlists. Evaluations remain private unless intentionally shared.
6. **Deal operations:** coherent tabs for status, parties/permissions, deliverables, messages, agreement/signatures, funding/payout, proof, deadlines, compliance and audit.

Design: original NIL identity with restrained near-black/charcoal surfaces, compact navigation, white/muted text, small status accents, dense tables, record tabs, consistent activity rail and mobile focus on Today/actions/messages/signatures. Avoid turning every element into a decorative card.

Architecture: documents, games, routes, scouting, deals, payments and messages must connect through shared athlete, organization and event identifiers. Build the internal model before adding external providers.

## 3. Stack and source map

Next.js 15.5.27 / React 19 / TypeScript / direct `pg` SQL / PostgreSQL. App Router, server actions, in-house cookie sessions and TOTP. Existing Stripe, Resend and cron integrations remain. Local validation used Node 26.6 and PostgreSQL 18; supported Node ranges are in `package.json`.

| Area | Main files |
| --- | --- |
| Authentication/MFA | `lib/session.ts`, `lib/mfa.ts`, `lib/lockout.ts`, `app/mfa/`, settings/admin MFA actions, admin reset scripts |
| Athlete access | `lib/access.ts`, `guardian_links` SQL view, `lib/operations.ts`, `app/dashboard/operations/` |
| Documents | `lib/documents.ts`, `lib/office-preview.ts`, `app/dashboard/documents/`, `components/document-upload.tsx` |
| Forg3 | `lib/signing.ts`, `lib/signing-pdf.ts`, `lib/deal-signing.ts`, `app/dashboard/signing/` |
| Deal workspace | `app/dashboard/deals/[id]/page.tsx`, contract page/actions, `work-actions.ts`, `lib/payee.ts` |
| Sports/routes | `lib/sports-operations.ts`, schedule/routes pages/actions, `components/route-map.tsx` |
| Scouting/metrics | `lib/scouting.ts`, scouting/metrics pages/actions, `lib/jobs/scouting-watch.ts` |
| Tasks/organizations | `lib/operational-tasks.ts`, `lib/organizations.ts`, tasks/organizations pages/actions |
| Today and styling | `app/dashboard/today/`, dashboard layout, `app/globals.css` |
| Retention/export/jobs | `lib/operations-erasure.ts`, `lib/account-deletion.ts`, settings export route, `lib/jobs/operations.ts`, job runner |
| News transport | `lib/safefetch.ts` |
| Tests | `lib/*.test.ts`, `tests/*.integration.test.ts`, e2e6/17/18/19, `e2e/runtime.mjs`, `e2e/start-local.mjs` |

New dependencies include pdf-lib/fontkit, yauzl, Leaflet and associated types. Noto Sans font and OFL license are under `assets/fonts/`. Font assets are included in Next build tracing. `outputFileTracingRoot` points to this repository to avoid selecting a parent-directory lockfile. Test tooling was updated; PostCSS is overridden to a patched compatible version.

Server-action modules marked `"use server"` may export only async functions; a unit test enforces this. Put shared types/constants elsewhere. No AGENTS.md was found during development; check for any newly added instructions before proceeding.

## 4. Migrations added

Apply through the existing migration runner, never manually rewrite already-applied migrations.

| Migration | Purpose |
| --- | --- |
| 017 | Required MFA re-enrollment after recovery |
| 018 | Organizations, versioned athlete documents, grants, activity, immutability |
| 019 | Signing envelopes/recipients/fields/sessions/evidence/events/artifacts/delivery records |
| 020 | Retained-user athlete references and one live envelope per document |
| 021 | Seasons, venues, event details/attendees, routes/stops, tasks, expenses, reminder dedupe |
| 022 | Scouting stages/templates/reports/follow-ups/activity/watch state |
| 023 | Frozen legacy-contract signing bridge |
| 024 | Narrow unsigned-document erasure exception after anonymization |
| 025 | Prevent new document versions during live/completed signing |
| 026 | Organization invitations |
| 027 | Explicit recruiter visibility for events |
| 028 | Scouting attachments and athlete metrics |
| 029 | Deal deliverable work items |

All were applied to the disposable local database, not a production database. New athlete references use retained `users.id`, joined to live athlete profiles for permissions, so deleting a profile does not destroy signed transaction evidence.

## 5. Implemented behavior and boundaries

### Security and MFA

Enrollment/disable and revocation of other sessions are transactional. Enrollment races cannot overwrite an enabled seed. MFA operations require a live session. Pending-MFA sessions are not authenticated for private pages/actions/files. Admin support reset requires password, reason and recent MFA, revokes all sessions and forces re-enrollment before private access. Admin server reset remains available; admin demotion now preserves MFA and revokes sessions. Recovery hashes work even when the TOTP encryption key cannot decrypt an old seed. Expired lockouts reset their attempt budget.

**Policy change to review explicitly:** Codex implemented action-based recent MFA (ten minutes) for contract signatures, guardian approvals, funding, payout setup/payee changes and funded cancellation operations, plus sensitive admin operations. Ordinary browsing remains optional for non-admins. The user's earlier summary left mandatory MFA for money-handling roles undecided; this implementation is a chosen action-based product default, not an explicit final role-wide mandate from the user. Do not describe that policy as independently approved or silently broaden it. See `docs/IMPROVEMENT_PLAN.md`.

Payout refresh is now a protected POST. Payee changes lock deal/payment records and are prohibited after transfer attempts or settlement. Offer text is screened and the open-offer limit is serialized. New downloads require verified full authentication and return 401 for pending MFA, 404 for inaccessible records. News fetching pins validated DNS addresses while preserving TLS hostname checks and revalidating redirects.

### Athlete and documents

Eight athlete tabs, overview rollups, Today view, responsive dark navigation and mobile action bar exist. Documents support nine categories, 5 MB PDF/Office uploads, folders/tags, filters, expiry, immutable versions and explicit sharing. Family access is checked against current authority; tax/identity are family-only and health/academic sharing requires matching consent. Document writes now lock and recheck family authority within their transactions.

PDF preview is authenticated and sandboxed. Modern Office previews extract bounded XML text with ZIP entry/byte/time limits and macro rejection. Legacy `.doc/.xls/.ppt` files download only. Office layout fidelity and conversion are not implemented. Files remain in Postgres; no malware scanner, quarantine or aggregate storage quota exists.

### Forg3 and deal execution

Persistent ordered signing, six capacities, five field types, expiring single-use user-bound sessions and immutable evidence/artifacts exist. Current authority/order/expiry/replay are checked. Each recipient needs a signature field; minors require guardian participation and cannot send an envelope alone. Final PDFs overlay values on the pinned source. The certificate includes source/completed hashes, consent, signer attribution, audit events and completion.

Generated PDFs use an embedded font, reject unsupported characters and illegible/out-of-page fields, and wrap using measured word widths with caching. Do not replace unsupported glyphs silently. The certificate is not a PKI signature or proof of legal compliance.

The generated-deal adapter renders frozen legacy contract terms and bridges completed signing into existing immutable contract signatures and deal activation. Arbitrary uploaded agreements cannot activate deals or release money. Existing executed/partially signed legacy contracts remain supported. Deliverable checklists, evidence from existing message attachments and buyer review are operational records; acceptance does not automatically release money or amend signed terms.

### Sports, scouting and daily operations

Season/event/venue/attendance/consent and route/stop records exist with tasks/expenses and timing warnings. Opt-in Leaflet/OSM maps show geographic stop sequence, not road directions or travel-time calculations. Exact schedules/locations are family-scoped; recruiter-visible events require explicit sharing.

Scouting supports private and explicitly organization-shared reports, templates, film/media, follow-ups, stages, basic comparisons and watchlists. Family sees a report only when intentionally shared. Discoverability/blocking are rechecked. Metrics can be independently verified by an authorized linked coach; this is attributed app verification, not external sports-data certification. Scouting attachment limits are serialized per report.

Organizations support creation and invitation/acceptance/removal. Organization membership alone never grants private athlete data. Some forms remain personal-record oriented. Tasks, expenses, in-app reminders, exports and deletion/redaction cover the new domains. Signed/partially signed agreement evidence is retained; unsigned private files can be erased after anonymization.

## 6. What still needs work

The full user request is not finished or production-ready. Continue from these concrete gaps:

1. **Document/signing UX:** visual page-based field placement/editing, accessible preview controls, faithful Office conversion where appropriate, clear recipient progress/next actions, validation that preserves drafts. Audit current forms rather than assuming all inputs/errors are accessible.
2. **Reliable delivery:** transactional email outbox, signing reminders/expiry notices, retries and delivery visibility. Current signing notices are in-app; existing security emails are best effort. Keep sensitive document/evaluation details out of notices.
3. **Upload operations:** quarantine/scanning, aggregate quotas, private object storage and deletion/retention. Fail closed when scanning fails. Preserve immutable completed evidence and authenticated download checks.
4. **Organization lifecycle:** ownership transfer and archival, sole-owner deletion, invite lifecycle/reinvitation, consistent organization IDs and organization record permissions without broadening athlete consent. Current sole-owner deletion can strand management.
5. **Event/travel completeness:** multi-athlete attendance editor, consent revocation, editing/cancellation workflow, venue reuse, complete stop linkage to contacts/documents/tasks/expenses/recruiting notes. The schema is richer than current forms.
6. **Scouting completeness:** explicit event-linked observations, richer comparison/metrics UI, clear verification provenance, consent-aware eligibility/academics and actionable watchlist history.
7. **Jobs at scale:** current reminder/watchlist batches are bounded and may starve older records; add fair pagination/checkpointing, retries and observability.
8. **Additional security/reliability:** distributed abuse controls, optional passkeys/multiple authenticators, recovery identity-verification procedure, thorough concurrent relationship/organization revocation tests, safe deletion of every new record type.
9. **Provider integration:** road routing/travel times and sports data only after internal model completeness; real Stripe test-mode/webhook and email-delivery validation. No real settlement or production email has been verified.
10. **Design and QA:** tighten dense record views, consistent right activity panels and actionable empty states; test keyboard/screen reader, mobile signatures/tables/forms, loading/error behavior and all roles. Port and rerun the remaining old browser suites.

Specific review cases: cancellation while a deal envelope is partially signed; stale recipient authority; source/field freezing; concurrent version/upload/sign operations; tiny PDFs, malformed files and long/non-Latin names; hidden proof attachments; guardian age-18 transition; notifications/exports/private evaluations; linked-record deletion; organization member removal during writes.

## 7. Verification at handoff

| Check | Result |
| --- | --- |
| Unit | 257/257, 30 files |
| Database integration | 58/58, 5 files |
| Ordinary MFA e2e18 | 88/88 |
| Admin MFA e2e17 | 73/73 |
| Settings/deletion e2e6 | 83/83 |
| Operations e2e19 | 14/14 |
| Final production build | Passed, exit 0 |
| Production dependency audit | Zero known advisories in recorded run |
| Whitespace/diff check | Passed |

Operations browser coverage: eight tabs, unrelated-account denial, upload, authenticated/no-cache bytes, MFA-pending denial, ordered signing, completed PDF/certificate, schedule, persistent route, mobile width and no browser runtime errors. This is not exhaustive coverage of the expanded product.

The last browser run preceded the final PDF wrapping and transactional document-authority changes. Dedicated unit/integration tests and final build cover those refinements. Rerun the browser suite after subsequent work. A new long-document test exposed a slow wrapping algorithm; caching and word-based wrapping fixed it without increasing the timeout. The historical two e2e6 assertion failures were fixed. Old messaging/news/social/payment regression claims in the historical Claude handoff were not reverified on this branch.

Local ignored artifacts are under `.test-output/`: unit/integration/build logs, e2e6/17/18/19 logs, audit JSON and mobile screenshot. They are excluded from the source ZIP. Development mail logs contain test tokens; do not publish them.

## 8. Reproduce safely

Use a fresh disposable local PostgreSQL database ending in `_e2e`. Integration/browser suites truncate tables and must run sequentially against that database. The portable runner rejects nonlocal/test-inappropriately-named databases. Do not weaken that protection.

```sh
npm ci
export E2E_DATABASE_URL=postgres://YOUR_LOCAL_USER@127.0.0.1:5432/lin_e2e
DATABASE_URL="$E2E_DATABASE_URL" npm run db:migrate
npm test
npm run test:integration
npx playwright install chromium
npm run test:app
```

In another terminal, using the same E2E_DATABASE_URL, run one at a time:

```sh
npm run test:e2e
npm run test:e2e:admin
npm run test:e2e:settings
npm run test:e2e:operations
```

Stop the dev server before the production build to avoid concurrent `.next` writes:

```sh
npm run typecheck
npm run build
npm audit --omit=dev
git diff --check
```

The runner defaults to port 3113 and `.test-output/mail.log`, clears real provider credentials and uses development-only MFA configuration. `psql` must be on PATH. `E2E_BASE_URL`, `E2E_MAIL_LOG` and `E2E_CHROMIUM_PATH` are supported. Older unported suites retain cloud-specific paths. Playwright is a project dependency now; the old `/opt/node-tools` symlink is only a legacy sandbox workaround.

Local previous database: `postgres://lin_test@127.0.0.1:55438/lin_e2e`, data directory `/tmp/lin-security.QHuMf4/pgdata`. It is disposable and may no longer be running. The dev server was stopped; no `.env.local` was created. Never assume these temporary paths exist in Claude's environment. Production requires a persistent `MFA_ENCRYPTION_KEY`; do not replace an existing key casually.

## 9. Gemini status and continuation sequence

A Gemini handoff exists at `docs/GEMINI_REVIEW_HANDOFF.md`. Two read-only CLI attempts produced no findings and were stopped; the cause was not identified. **There is no independent Gemini approval.**

Recommended continuation:

1. Confirm that the current source snapshot/local changes are actually present. Read this document, `docs/OPERATIONS_IMPLEMENTATION.md`, `security_best_practices_report.md` and the current section of `docs/HANDOFF.md`.
2. Compare implementation to the user's full requirements. Establish a concrete gap list; fix reproducible authorization/data-integrity issues first.
3. Complete the remaining document/signing, organization and sports/scouting workflows in cohesive increments, with meaningful tests. Preserve the shared identifiers and existing money state machine.
4. Validate policy-sensitive behavior explicitly, especially the new recent-MFA requirement; distinguish Codex's chosen defaults from user decisions.
5. Run affected tests, then the full available verification set. Report new failures rather than relabeling them known or hiding them with retries/timeouts.
6. Update documentation and the Gemini packet to the final code. Ask Gemini for independent bugs/design/UX review when available; verify and fix its concrete findings.
7. Report what is implemented, what remains, what passed, what was mocked and whether anything was committed/pushed/deployed. Do not claim completion solely because compilation passes.

The historical portion of `docs/HANDOFF.md` contains old `/home/user/LIN` paths, branch/push statements and Claude harness instructions. The current local status above supersedes those claims; do not copy stale commit trailers or assume the current work was already pushed.

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

### Gemini independent review (2026-10-14) — triage
Gemini reviewed `76de1b5` read-only and reported 6 defects, 2 hypotheses and 4 UX items. Each was verified against the code before acting.

Fixed (with tests):
1. **Re-issued deal agreement notified signers with the voided envelope's link.** Confirmed; the notice now points at the new envelope and is sent after it exists (`lib/deal-signing.ts`; `tests/deal-signing.integration.test.ts`).
2. **Guardian consent outlived the guardian.** Confirmed; the schedule now shows consent only while its giver is a current guardian (`guardian_links`), removing a guardian clears the consents they gave, and erasure clears consents given by the erased account (`lib/sports-operations.ts`, `app/dashboard/team/guardian-actions.ts`, `lib/operations-erasure.ts`; `tests/events.integration.test.ts`).
4. **Legacy contract signing asked for MFA before checking standing.** Confirmed; standing is now checked first (`app/dashboard/deals/contract-actions.ts`; `tests/actions.integration.test.ts` rewritten so every MFA-gate case is a transition the actor is entitled to make, plus a no-standing case).
5. **Data export omitted passkeys.** Confirmed; name, device type, backup state and timestamps are exported (never key material).
6. **Organizer excluded from `accessibleEvent`.** Confirmed (a leftover from the earlier family-only rule); the organizer is back in scope.
- Hypothesis 1 (SigV4 `content-length`): `content-length` is no longer signed, so the signed set matches exactly what is sent.
- UX 1–4: explicit `htmlFor` on the passkey name field; the field placer clamps width to the page and supports touch (`touch-action: none`); adult athletes see "no guardian consent needed" instead of a misleading "No guardian consent recorded".

Not a defect (rejected with reasoning):
3. **"Unapproved team member allowed as agent/school/internal recipient."** `guardian_approved` is the *parent* relationship's flag. Coach/manager/trainer relationships are created only by accepting an invite the family sent and are inserted with `guardian_approved=false` by design (`app/connect/actions.ts`); `subjectsFor` likewise ignores the flag for non-parent roles. Requiring it in `recipientAuthorized` would block every legitimately invited agent or school signer. The same reasoning fixed an over-strict check of ours in `lib/sports-events.ts` (`knownAthlete`).

Deferred (product gap, documented):
- Hypothesis 2: travel stops store instants but no time zone, so turnaround warnings across zones are approximate. Fix is a per-stop zone like events have.
- Office→PDF conversion, real bucket/ClamAV/Stripe/email soak, road routing: unchanged, see above.

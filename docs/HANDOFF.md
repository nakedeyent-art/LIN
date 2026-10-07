# LIN — handoff for the next session

Written at the end of a long build conversation so a fresh session (different model) can continue without re-deriving anything.
Repo `nakedeyent-art/LIN`, working dir `/home/user/LIN`, **branch `claude/sleepy-bohr-us0ind`** (everything is committed and pushed; head `10bc581`; no PR has been opened — the user has not asked for one).

## 1. What LIN is
A sport-agnostic NIL (name-image-likeness) ecosystem. Logins for athletes, parents/guardians, coaches, trainers, gym owners/team organizers, sponsors, boosters/collectives,
tournament managers, recruiters and managers/agents, each with a role-specific dashboard; an athlete-development OS (academics eligibility gate, nutrition, training with
periodization) with regulatory guardrails; a deal flow with guardian approval, e-signature and Stripe payments; deal messaging; notifications; an admin panel with MFA;
a news feed; and a social feed with a Spotify/Apple Music profile status. **Minors' safety is the central design constraint** (see §4).

## 2. How the user works
- Incremental requests phrased "Add X next". They want honest reports: say plainly what was verified against mocks only, what isn't built, and what failed.
- **Do not open a PR unless asked.** Commit and push to `claude/sleepy-bohr-us0ind`. A Stop hook nags if the tree is dirty — commit/push checkpoints.
- Commit trailers (from the harness): `Co-Authored-By: Claude <model> <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01SRikBnTjQH1T7TtZvs1FAG`. Don't put a model identifier in code/commit bodies beyond the trailer the harness dictates.
- Use pronouns they/them for people whose pronouns aren't stated. Keep final reports tight (what changed, what was tested, what's not built).
- The user is non-technical-leaning on infra; explain risks in plain words. They asked for "higher intelligence" for the next stretch — expect them to want review/hardening as well as features.

## 3. Stack and conventions
- Next.js 15.5 (App Router, server actions, `after()`), React 19, TypeScript, plain `pg` (no ORM), Postgres 16, vitest (unit), Playwright (e2e scripts in `e2e/`). Node 22.
- Migrations: `db/migrations/001…015_*.sql`, applied by `scripts/migrate.mjs` (`DATABASE_URL=… node scripts/migrate.mjs`, or `npm run db:migrate`).
- Layout: `lib/` = domain + DB code (pure rule modules have `*.test.ts`), `app/dashboard/*` user pages, `app/admin/*` admin panel, `app/mfa/*` admin second step, `app/api/*` (cron, Stripe webhook), `components/*`, `scripts/*` (migrate, make-admin, reset-admin-mfa, mock-stripe).
- **Pattern:** keep rules in pure modules and unit-test them (`lib/deals.ts`, `contract.ts`, `money.ts`, `payment-rules.ts`, `messaging.ts`, `content-filter.ts`, `attachments.ts`, `images.ts`, `news.ts`, `social.ts`, `music.ts`, `totp.ts`, `admin.ts`, `reports.ts`…), do SQL in `*db.ts` files, keep server actions thin.
- **`"use server"` files may export only async functions** (a guard test `lib/server-actions.test.ts` enforces it; put shared types/constants in `lib/`).
- Auth is in-house: scrypt hashes, hashed DB sessions (`lib/session.ts`), lockout, email verification, password reset. Authorization: `requireAccess(href)` checks the role's nav list (`lib/roles.ts`), `lib/access.ts`, and the DB view `guardian_links` (guardian authority exists **only while the athlete is under 18**). Never bypass that view.
- Money: DB intent first, then Stripe, with idempotency keys; retry job. Prices are integer cents.
- Email: `lib/mailer.ts` (Resend in prod; in dev it prints to the server log — e2e tests read links from that log).
- Scheduler: `POST/GET /api/cron/daily` (Bearer `CRON_SECRET`, ≥16 chars) runs jobs in `lib/jobs/runner.ts` under an advisory lock: `adult-transition`, `payments-retry`, `news-ingest`, `housekeeping`. `vercel.json` schedules it daily; **hourly is recommended** (payout retries and news freshness ride on it).

## 4. Feature inventory (by migration)
001 schema · 002 email verification + guardian linking · 003 deals + deal_events · 004 real data (academics, nutrition, training, events, recruiting) · 005 password reset · 006 account settings + purge-and-anonymize deletion (`lib/account-deletion.ts` — **every new table holding personal data must be added to the purge**) · 007 guardian management (view `guardian_links`, adult-consent sharing) · 008 scheduled jobs / 18th-birthday transition ·
009 contracts (deterministic text + SHA-256, typed-name e-sign with ESIGN consent, immutable via triggers) + Stripe Connect payments (fund → hold → release/refund, webhook verified/deduped, disputes shown as warnings only) ·
010 deal messages · 011 notifications (in-app, coalesced), email preferences, admin flag/suspension, append-only `admin_audit` · 012 message reports/blocks/moderator hiding/attachments (Postgres bytea, PNG/JPEG/PDF ≤2 MB)/FTS search · 013 news (admin-managed RSS/Atom sources, keyword tagging, saved filters) · 014 social (posts, follows, likes, comments, content reports, profile status + music) · 015 admin MFA · 016 MFA for everyone (tables renamed `user_mfa` / `user_recovery_codes`; `security_events`).

Key behaviours worth remembering:
- **Minors:** shown as "First L." to non-family; a deal/thread/post involving a minor is always guardian-visible; contact details/links/social handles are blocked in any text by or to a minor (`lib/content-filter.ts`); a minor's posts/status/music reach only themselves, guardians and **guardian-approved followers**, never Discover; boosters can't offer to or follow minors; a minor can block but only a guardian lifts it; guardians lose all authority at 18 (blocks they set lapse).
- **Privacy:** admins never see message text, grades, nutrition, training or health data; moderators see a reported item plus ±3 neighbours, every read audited; image uploads have EXIF/GPS stripped (`lib/images.ts`); notifications/emails never contain amounts or message bodies.
- **Admin:** granted only by `scripts/make-admin.mjs <email> [--revoke]` (shell + DB access). Every admin change needs password re-entry + a written reason and is audited. **MFA (TOTP + 10 recovery codes) is mandatory for admins and optional for everyone else** (an enrolled account's session is not signed in until the second step passes — `getSession()` returns null for it; `getPendingSession`/`requireMfaPage` are only for the /mfa pages; support reset for ordinary accounts is on the admin user page); session must be second-step-verified within 8 h (`requireAdmin`, `getAdminSession`, `requireAdminBasic` in `lib/session.ts`); seed encrypted with `MFA_ENCRYPTION_KEY`; lost-device reset via `scripts/reset-admin-mfa.mjs`. Details in README.
- **News:** LIN ships with **no sources and no content licence**; stores headline + ≤240-char excerpt + link only; SSRF-hardened fetch (`lib/safefetch.ts`); a flaky source never fails the job.
- **Music:** link-paste only (no OAuth); `lib/music.ts` rebuilds canonical/embed URLs from parsed parts; the player iframe loads only after a click.

## 5. Environment variables (see `.env.example`)
`DATABASE_URL`, `APP_URL` (required in prod), `RESEND_API_KEY`, `MAIL_FROM` (required in prod), `CRON_SECRET`, `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `PLATFORM_FEE_BPS` (payments off if the key is empty), **`MFA_ENCRYPTION_KEY`** (required in prod; `openssl rand -base64 32`; changing it forces every admin to re-enrol).
Test-only: `STRIPE_API_BASE` (mock Stripe; ignored in production), `NEWS_ALLOW_LOCAL=1` (lets news sources be `http://localhost…`; ignored in production).

## 6. Running things in the cloud sandbox
- **Postgres stops between turns** (`ECONNREFUSED 5432`): `service postgresql start; sleep 4`, then migrate. DB `lin`, user/pass `lin`/`lin`; psql as `su postgres -c "psql lin -At"`.
- App for tests: `bash e2e/start-app-news.sh > /tmp/claude-0/mail.log 2>&1 &` (port 3113, dev mode). Stop it with `fuser -k 3113/tcp` — **never `pkill -f`** (it kills the tool shell, exit 144).
- Unit tests `npx vitest run` (242 pass), `npx tsc --noEmit`, production build `rm -rf .next && npx next build` (stop the dev server first).
- E2E scripts are in `e2e/` (see `e2e/README.md`; they truncate the `users` table). Chromium: `/opt/pw-browsers/chromium`. Payments suites need `node scripts/mock-stripe.mjs` (port 4010) and `e2e/start-app-payments.sh`.
- A long command >10 min is auto-backgrounded; keep e2e runs under ~9 min each.

## 7. Test status at handoff
242 unit tests, `tsc` and a clean production build pass. Last full e2e results: e2e12 47/47, e2e13 72/72, e2e14 103/103, e2e15 57/57, e2e16 118/118, e2e17 73/73, e2e18 78/78 (MFA for ordinary accounts), e2e3 pass, payments suites (e2e9 123, e2e10 9, e2e11 12/12 earlier) — the payments suites were **not re-run after the messaging→MFA work** (nothing touched payment code). Known baseline failures (test-script bugs): see `e2e/README.md` (e2e4 ×3, e2e6 ×2).

## 8. Gotchas that cost time (don't repeat)
- Card titles render **uppercase via CSS**, so e2e text regexes must be case-insensitive (`see()` already is; raw `.test()` isn't).
- psql `-At` prints booleans as `t`/`f`, and boolean `||` text gives `true`/`false`.
- React 19 **resets uncontrolled forms after a server action** — error paths must return the draft (`PostState.draft` etc.) and the textarea uses `defaultValue` + a `key`.
- HTML `required`/`minlength`/`pattern`/`maxlength` block submission in the browser, so server-side validation tests must remove those attributes first.
- `/mfa/*` and `/login`-style pages use `.center`, not `<main>`; e2e helper `text()` reads `main, .center`.
- Dev-server recompiles can make the first request slow; one e2e "flake" was a signup race (email-verified flag set after first navigation).
- DB immutability: contracts/signatures/deal_messages/admin_audit have triggers — tests that backdate rows must disable the trigger temporarily.
- Stripe `Buffer` bodies: wrap with `new Uint8Array(...)` for `NextResponse`.

## 9. Known gaps / sensible next steps (none are in progress)
**Before real users (highest value):** image/attachment malware & illegal-content scanning; object storage instead of bytea; IP-level rate limiting (login/signup/reset/report are per-account only); WebAuthn/passkeys and a decision on whether to make MFA mandatory for money-handling roles; legal review of the contract template, state NIL rules (`canOffer`), custodial/tax rules for paying minors (1099s), money-transmitter question; set `MFA_ENCRYPTION_KEY`, `APP_URL`, `RESEND_API_KEY`, `CRON_SECRET`; run **real Stripe test mode** (payments were verified only against a local mock; webhook signing cross-checked with the official library) and a real feed/real email provider (news and mail were verified only against local mocks).
**Product:** short-form video (needs storage + transcoding + video moderation); live "now playing" via Spotify/Apple APIs; push/SMS; per-team/athlete news following and a daily digest; licensed scores/rankings data; hashtags/mentions/reposts; appeals and moderator roles below full admin; dispute-resolution workflow and admin-initiated refunds; counter-offers/edits to deals; manager/agent acting for athletes; school-system/wearable integrations; per-state time zones; retention schedule for deleted-account records.
**Engineering:** wire `e2e/` into a runnable harness (it's sandbox-specific today); root-cause the e2e4/e2e6 baseline failures; consider Postgres RLS as defence in depth; code-review/security-review pass over the whole branch (it's ~15 migrations of unreviewed-by-humans code); open a PR when the user is ready.

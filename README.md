# LIN — NIL Ecosystem

A sport-agnostic NIL platform where every role (athlete, parent, coach, trainer, gym owner/organizer,
sponsor, booster, tournament manager, recruiter, manager/agent) gets a **different dashboard** built for
its own needs, plus an Athlete Development & Representation OS (academics, nutrition, training) with
built-in regulatory guardrails.

## Run
```
npm install
cp .env.example .env.local     # set DATABASE_URL to a Postgres 13+ database
npm run db:migrate             # applies db/migrations/*.sql (forward-only, tracked in schema_migrations)
npm run dev                    # http://localhost:3000  (sign up, then log in)
npm test                       # domain + auth crypto tests
npm run typecheck
```

## What exists now
- Real auth: email + password sign-up/login, scrypt hashing, 7-day server-side sessions (only a SHA-256 of the
  cookie token is stored; httpOnly, SameSite=Lax, Secure in production), logout invalidates server-side,
  lockout after 5 failed logins (15 min), uniform login errors and timing for unknown emails
- Guardian management (Team page): guardian authority exists **only while the athlete is under 18** — enforced in one
  database view (`guardian_links`) that every guardian power check uses. A guardian can invite another guardian (verified
  Parent account + matching email, max 4 incl. pending), remove another guardian or step down (the count is re-read inside
  a lock so two guardians removing each other can't leave a minor with none; the last guardian can't leave while deals are
  open), list/unlist the minor to sponsors, and delete the minor's account. A minor whose last guardian leaves is
  unlisted automatically, and (like a mistyped signup address) can name a replacement guardian from their dashboard.
  Every change is logged (`guardian_events`, masked emails only) and emailed
- Turning 18: consent transfers to the athlete. Former guardians lose all access by default; the athlete may choose to
  keep sharing academics and/or nutrition+training with a parent (**view-only**, revocable, never deals), or remove the
  link. A deal that was awaiting a guardian when the athlete turned 18 is decided by the athlete. Adulthood is evaluated
  from birth date at query time (no job needed)
- Scheduled jobs (`lib/jobs/*`, `GET|POST /api/cron/daily`): a small runner with the **18th-birthday transition** as its first
  job. For each athlete who has turned 18 it voids guardian invites that can no longer be accepted, writes a guardian-audit
  entry, and emails the athlete and each former guardian (names and counts only — no amounts or addresses). It never emails
  someone who joined already 18+, whose birthday was more than 30 days ago, or who never had a guardian. It's idempotent
  (`athlete_profiles.adult_notice_sent_at`), single-flight (Postgres advisory lock; overlapping triggers return
  `skipped_locked`), retries failed deliveries up to 5 times then gives up, supports `?dry=1`, and records each run in
  `job_runs`. The endpoint needs `CRON_SECRET` (≥16 chars) as a Bearer token and returns 503 if it isn't set
- Account settings (`/dashboard/settings`): edit name (athletes: sport/position/state/grad year); change password
  (re-enter current one; ends other devices; wrong attempts feed the same lockout as login); change email (needs the
  password, link goes to the **new** address and only works for the **same logged-in account**, the old address gets a
  masked heads-up and a "was changed" notice, other devices are signed out, taken addresses get the same generic reply
  so it can't probe for accounts); fix a mistyped address while still unverified; sign out other devices; download your
  data as JSON (POST-only, own data only, no password hashes); **delete account** (password + typing DELETE; blocked
  while you have open deals, or as a guardian while a linked minor does)
- Deletion purges and anonymizes instead of hard-deleting: profile, grades, study/meal logs, plans, workouts, team
  links, invites, sessions and tokens are removed, the original email is freed for reuse, and the user row stays as
  "Deleted user" so counterparties' deal history and the audit trail remain intact
- Password reset (`/forgot-password`, `/reset-password`): the request page answers identically whether or not the
  email has an account (lookup + send run after the response, so timing doesn't leak it); links are single-use,
  expire in 1 hour, are stored hashed, and only *display* a form on GET (spent on the POST); per-account cooldown
  (1/min) and cap (5/hour). Resetting ends **all** sessions, clears any lockout, voids other outstanding reset
  links, marks the email verified (the person just proved mailbox control), and emails a "password was changed"
  notice. One shared password policy (`lib/password-policy.ts`) applies to signup and reset
- Email verification: a verified email is required before any dashboard page. Tokens are random, stored hashed,
  single-use, expire in 24h; the emailed link only shows a confirm button (the POST consumes the token, so link
  scanners can't burn it); resend is rate-limited to once a minute
- Guardian linking: a minor athlete's invite emails the guardian a 14-day single-use link. It's accepted only by a
  logged-in, **verified Parent account whose email equals the invited email** (claimed atomically), which creates the
  consent-flagged `athlete_relationships` row. Athletes see a "guardian approval needed" banner and can re-send
  (re-sending invalidates the old link). Parents see their linked athletes
- Sign-up captures role-specific data: athletes give sport/birth date (under 18 requires a guardian email); managers must declare their capacity (`manager_declarations`)
- Deal flow (`lib/deals.ts` rules, `app/dashboard/deals/*`): sponsors, boosters and gym owners find **opted-in**
  athletes and send offers (amount, deliverables, FMV/no-pay-for-play attestation, 14-day expiry, max 3 open per
  athlete). Athlete accepts/declines; **a minor's acceptance only moves the deal to guardian review and a linked
  guardian must approve** before it's active; the offerer can withdraw open offers and mark active deals complete.
  Every transition is checked server-side in one state machine, row-locked (no double decisions), written to an
  append-only `deal_events` audit trail, and emailed (links only, never amounts)
- Privacy: athletes are unlisted by default; minors can only be listed once a guardian is linked; sponsors see
  sport/position/level and a minor's name as "First L."; email and birth date are never exposed
- 10 distinct role dashboards (`components/dashboards.tsx`), every number computed from the database; where there's no data yet they show honest empty states with a next step (no placeholder figures remain — metrics with no real source, like follower counts or NIL value estimates, were removed rather than faked)
- Role-gated nav and routes (`lib/roles.ts`, `requireAccess` in `lib/session.ts`)
- Team & consent (`app/dashboard/team`, `lib/access.ts`): an adult athlete — or, for a minor, a linked guardian — invites
  a coach/trainer/manager/recruiter by email and chooses exactly what they see (academics and/or nutrition+training).
  Accepting needs a verified account whose email **and role** match. `lib/access.ts` is the single authorization source:
  athletes see themselves, guardians see linked athletes, everyone else only what a relationship row grants;
  access can be removed instantly
- Academics: athletes enter grades and study sessions; guardians/managers verify study time (never the athlete);
  trends, yellow/red alerts and the weekend-competition gate are computed from real entries
- Nutrition: athlete/guardian saves body details; targets are computed by formula from a performance profile
  (nobody types calorie numbers, so the minor floor of BMR always holds); credentialed trainers / certified-coach
  managers may set the profile; athletes log meals; 14-day compliance (calories ±10%, protein ≥ 90%)
- Training: trainers and certified-coach managers prescribe structured workouts to connected athletes; the in-season
  high-school rule is enforced **server-side**; athletes check off exercises on the day (adherence = share done);
  past unfinished workouts count as missed; 2+ missed in a week raises an alert
- Events (tournament managers) and a recruiting board (recruiters track listed athletes; academics appear only if the
  family invited them and chose to share)
- Compliance page (`app/dashboard/compliance`)
- Tested domain rules in `lib/calc.ts`: BMR/macros (no sub-BMR for minors), grade alerts, eligibility gate,
  missed-session alert, in-season high-school training restriction
- Postgres schema in `db/migrations/001_init.sql`
- All product data is real and database-backed; there is no mock data left in the app

## Payments and e-signature
Deal flow: offer → athlete accepts → (minor: guardian approves) → **both sides sign the agreement** → sponsor **funds** it
(Stripe Checkout) → work happens → sponsor marks it completed → payment is **released** to the payee. A deal only becomes
`active` when the contract is fully signed. Funded deals can be cancelled only if both sides agree (refund to the sponsor).
- **Agreement:** deterministic text (`lib/contract.ts`, template `nil-v1`) frozen with a SHA-256 hash; typed-name signatures
  with ESIGN-style consent, time, IP and user agent. Signed agreements are immutable (DB triggers). Download is `.txt`.
  The template is a starting point, **not legal advice** — have counsel review it before use.
- **Money:** Stripe Connect Express (payee onboards via `/dashboard/deals`), hosted Checkout, transfers and refunds with
  idempotency keys. Intent is committed to the DB before calling Stripe; `payments-retry` job finishes stuck releases/refunds.
  Payee is the adult athlete, or the approving guardian for a minor. Platform fee: `PLATFORM_FEE_BPS` (default 0, max 2000).
  Minimum deal is $1.00 when payments are on. Payments are off unless `STRIPE_SECRET_KEY` is set.
- **Webhook:** `POST /api/stripe/webhook` (set `STRIPE_WEBHOOK_SECRET`); subscribe to `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `account.updated`, `charge.dispute.created`,
  `charge.dispute.closed`. Signatures are verified, events de-duplicated.
- **Local testing:** `node scripts/mock-stripe.mjs` (port 4010, key `sk_test_mock`) with `STRIPE_API_BASE=http://localhost:4010`
  (ignored in production).
- **Scheduling:** payout retries ride on `/api/cron/daily`; call it **hourly** if you take real payments.
- **Verified only against a local mock of Stripe** (webhook signing cross-checked with the official library) — run through
  Stripe test mode before going live.
- **Not built:** automatic dispute handling (disputes are shown as a warning only), syncing refunds made in the Stripe
  dashboard, tax forms (1099), custodial rules for paying minors, PDF output, admin/support tooling, money-transmitter review.

## Messaging
Each deal has one shared thread (`/dashboard/deals/[id]/messages`) visible to exactly the people who can see the deal:
the sponsor, the athlete and — while the athlete is under 18 — their linked guardians, so a minor never has a private
conversation with a sponsor. Guardians lose the thread when the athlete turns 18 (the athlete keeps the full history).
- Open while an offer is being negotiated, signed, active or finished; closed when an offer is declined, withdrawn or has
  expired. A minor's thread pauses if no guardian is linked.
- Plain text (shown escaped, 2000 characters, control/bidi characters stripped), 8 messages per minute per sender per deal.
- Messages can't be edited or deleted (DB trigger). Deleting an account replaces that person's messages with
  "[message removed]" and shows them as "Deleted user"; the other people's messages stay.
- Email nudges never contain message text, and go once per unread burst per person. Unread counts show on the deals list and deal page.
- **Live updates:** an open thread polls a small feed every 5 seconds while the tab is visible (no polling in background tabs);
  new messages appear without a refresh and count as read. Polling rather than websockets keeps it working on serverless hosting.
- **Attachments:** PNG, JPEG or PDF, 2 MB each, 3 per message, 20 per deal. The file's bytes decide the type (not its name), they
  are stored in Postgres, and downloads are attachment-only with `nosniff`, a sandbox CSP and no caching, visible to the same people
  as the thread. **Not virus-scanned**, and Postgres storage should move to object storage before real volume.
- **Screening:** abusive/sexual language is blocked in every thread; off-platform payment talk is blocked when payments are on;
  contact details, links and social handles are blocked in threads with a minor. It only blocks (nothing is stored or shown to
  admins) and it is a speed bump: it can be evaded and can occasionally refuse an innocent message, so the sender's draft is kept.
- **Reporting:** any person on a deal can report another's message (reason + optional note, 10/day). Moderators see the reported
  message plus three either side — nothing more of the conversation — and every read is audited.
- **Blocking:** blocking closes messaging between the two people on every deal they share and stops new offers (and hides the athlete
  from that sponsor's directory) without telling the other side who blocked whom; deals already underway continue. A minor can block
  but only a guardian can lift it; a guardian can block for a minor, and that block lapses when the athlete turns 18.
- **Moderation (admin → Reports):** urgent "risk to a young athlete" reports sort first. Outcomes: dismiss, hide the message (text
  kept for the record; users see "[removed by a moderator]"), hide + warn, or hide + suspend. Each needs the admin's password and a
  reason, closes every open report on that message, tells the reporter the outcome in general terms and never tells the sender who reported.
- **Search:** `/dashboard/deals/search` finds your own deals (title, people) and message text (`"phrases"`, `-exclude`); hidden and
  removed messages never match; minors are shown as "First L." to people outside the family.
- Not built: image previews/thumbnails, message reactions or replies, typing indicators, push notifications, automated moderation
  beyond the screen above (no ML, no image scanning), appeals, moderator roles below full admin, SLA tracking/queues by assignee.

## News feed
`/dashboard/news` (in every role's navigation): high-school and college stories tagged automatically as **rankings, reclassification,
graduating seniors & commitments, redshirts, powerhouse programs** or general, with level and sport detected from the text. Readers
filter by topic, level, sport, time window (today / week / 30 days) and search, and can **save their filters as their default**.
- **Where stories come from:** an admin adds RSS/Atom feeds under *Admin → News* (and can post editorial items). **LIN ships with no
  sources and no licence to any publisher's content** — only add feeds you have the right to display. LIN stores the headline, a short
  plain-text excerpt (240 characters) and a link back; never full articles. Admins can hide any story.
- **Ingestion** runs as the `news-ingest` job (each source at most every 30 minutes; a source that fails 10 times in a row is switched
  off and shown as such; a flaky publisher never fails the job). Call `/api/cron/daily` **hourly** to keep it fresh. Fetching is
  https-only, public-IP-only (re-checked on every redirect), 8 s / 1 MB bounded, XML entity expansion off, and only `http(s)` links are kept.
- Tagging is keyword-based, not editorial judgement: expect misses and the occasional wrong tag. Rankings are the publishers' opinions.
- Not built: licensed data/APIs (scores, stats, official rankings), per-team or per-athlete following, a daily digest email, bookmarks.

## Social feed and music status
`/dashboard/feed`: posts (500 characters and an optional PNG/JPEG picture), a **Following** tab and a **Discover** tab, likes, comments,
profiles (`/dashboard/feed/u/…`) with a status line and a music link, follow/unfollow, block and report.
- **Minors:** an athlete under 18 is shown as "First L."; their posts, status and music reach only themselves, their guardians and
  followers **a guardian has approved** (*Feed → Follow requests*), and they never appear in Discover. Boosters can't follow minors
  (same rule as offers). Contact details, links and social handles are blocked in any post or comment by or on a minor. A minor can block
  someone for safety, but only a guardian lifts it. Guardian authority ends at 18 like everywhere else.
- **Pictures:** EXIF/XMP/GPS and PNG text chunks are stripped before storing (also for message attachments), served sandboxed with
  `nosniff`. Stored in Postgres; not scanned for illegal or unsafe content — **add image scanning before real users**.
- **Music:** no account linking. Users paste a Spotify or Apple Music link; it's validated strictly and only the parsed parts are kept
  (tracking parameters are dropped), and the official embed URL is rebuilt from them. The player loads **only after a click**, so
  viewing a profile never contacts Spotify or Apple. Not built: live "now playing" via the Spotify/Apple APIs (needs developer
  credentials and OAuth), titles/artwork pulled from the providers, and any audio hosted by LIN.
- **Safety:** the message screen applies (abuse everywhere; contact details around minors); posts and comments can be reported
  (*Admin → Post reports*: hide, hide + warn, hide + suspend, all with password + reason + audit); blocks hide each other's posts,
  comments and profile and remove follows (a block also closes deal messaging between the same two people).
- **Not built:** short-form **video** (the TikTok part — needs storage, transcoding and video moderation), reposts/sharing, hashtags,
  mentions, stories, direct messages outside deals, trending/algorithmic ranking (Discover is simply newest adults' posts), notifications
  for likes, and automated moderation beyond keyword screening.

## Notifications
An in-app notification centre (`/dashboard/notifications`, with an unread count in the sidebar) sits alongside the emails.
Deal changes, payment events, new messages and the "you're 18" transition create notifications; repeated events (five
messages) fold into one unread row. Text never contains amounts or message bodies, and links must stay inside `/dashboard`.
Under Settings, people can turn off the optional emails (deal/payment updates, new messages); security emails
(verification, password and email changes, deletion) are always sent. Read notifications are removed after 90 days by the
`housekeeping` job (which also drops expired sessions and job logs older than 180 days), so keep the scheduler running.
Not built: push/SMS, per-event preferences, notifications for guardian invites/removals and team invites (those stay email-only).

## Admin panel
`/admin` (404 for everyone who isn't an admin). Admin rights are granted **only** from a shell with database access:
```
node --env-file-if-exists=.env.local scripts/make-admin.mjs you@example.com            # grant (account must be verified)
node --env-file-if-exists=.env.local scripts/make-admin.mjs you@example.com --revoke   # revoke and end their sessions
```
- **Overview:** account and deal counts, open card disputes, payments stuck mid-processing, latest job runs.
- **Users:** search; account facts; suspend/restore (signs them out; login says "suspended" only after the right password),
  clear a lockout, resend verification, correct an athlete's birth date (blocked while they have open deals or money in flight;
  a minor with no guardian is unlisted).
- **Deals:** list/filter; terms metadata, agreement hash, payment log; retry a stuck release/refund (idempotent at Stripe).
- **Audit log:** append-only (DB trigger). Every change needs the admin's password again and a written reason; viewing a
  user's details is logged too (once per hour per user).
- **Boundaries:** admins can't change themselves or other admins, and never see message text, grades, nutrition, training or health data.
- **Two-factor authentication (required for every admin):** see below.
- **Not built:** IP allow-listing, hardware security keys / passkeys (WebAuthn), MFA for non-admin accounts, roles below "full admin", approving
  credentials, refunds/payouts initiated by an admin, content moderation, deleting accounts on someone's behalf, a dispute-resolution workflow.

### Admin two-factor authentication
Admin pages need **password + an authenticator-app code** (any TOTP app: Google Authenticator, 1Password, Authy, …).
- **First visit:** a newly granted admin is sent to `/mfa/setup` and can't see anything in `/admin` until they scan the QR code, enter a code
  (and their password again) and save their **10 one-time recovery codes** (shown once; only hashes are stored). Admins can't turn it off.
- **Every session:** a new sign-in must pass the second step at `/mfa/verify` (a code, or a recovery code), and again after **8 hours**.
  Verifying one session doesn't verify another. Admin download routes (reported pictures/attachments) enforce the same rule.
- **Protections:** codes are RFC 6238 (checked against the RFC's test vectors) with ±1 step of clock drift; a step can't be used twice (replay);
  5 wrong codes lock the second step for 15 minutes (audited); the TOTP seed is stored **encrypted (AES-256-GCM) with `MFA_ENCRYPTION_KEY`**,
  bound to its owner, so a copied row is useless; recovery-code use and enrolment are emailed and audited; regenerating codes needs the
  password plus a live authenticator code.
- **Server key:** set `MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`) in production — the app refuses to enrol or verify without it. Changing the
  key makes existing seeds unreadable, so every admin must be reset and re-enrol. Back the key up with your other secrets.
- **Lost phone *and* recovery codes:** someone with server/database access runs
  `node --env-file-if-exists=.env.local scripts/reset-admin-mfa.mjs admin@example.com "reason, how you verified them"` (audited, ends their sessions);
  the admin enrols again. Revoking admin rights (`make-admin.mjs --revoke`) also deletes their two-factor data. Treat both scripts like root access.
- **Limits:** TOTP can be phished in real time like any one-time code (passkeys/WebAuthn would resist that and aren't built); there is no
  "remember this device"; the first factor is still a password, so keep admin passwords unique and long.

## Scheduling the jobs
Set `CRON_SECRET` (e.g. `openssl rand -hex 32`) and have *any* scheduler call the endpoint once a day:
```
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.example/api/cron/daily          # real run
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://your-app.example/api/cron/daily?dry=1"  # preview only
```
- **Vercel:** `vercel.json` already schedules it daily at 14:00 UTC; Vercel Cron sends the Bearer token automatically when
  `CRON_SECRET` is set in the project's environment variables.
- **Anywhere else:** a system cron entry, a GitHub Actions `schedule:` workflow, or your host's scheduler running the `curl` above.
Dates are evaluated in UTC. Running it more often is harmless (idempotent); missing a few days is fine (the 30-day window
catches up). Add new jobs to `JOBS` in `lib/jobs/runner.ts` — each must be idempotent and safe to retry.

## Known gaps (do before real users)
- Set `APP_URL`, `RESEND_API_KEY` and `MAIL_FROM` for production; in production the app refuses to send without them (dev mode logs emails instead).
- Guardian links are one-to-one by email; there is no flow yet to add a second guardian, revoke a guardian, or
  re-link when an athlete turns 18 (consent should transfer to the athlete).
- Deals: see "Payments and e-signature" for what's built and missing; no counter-offers/edits (withdraw and re-offer); managers/agents
  can't act for athletes yet; the booster-to-high-school ban and other offer rules in `canOffer` are conservative
  defaults that need per-state legal review; no admin tooling to see/resolve disputed deals.
- No IP-level rate limiting (login, signup, reset and email change are limited per account only). MFA exists for admins only (see Admin panel); ordinary accounts have none.
- Guardian identity is only as strong as email control — nothing verifies that a "parent" is actually the athlete's
  parent. Any one guardian can remove another (logged and emailed, but there's no dispute/custody process). The "you're
  18" email goes out when the daily job runs (so it needs scheduling, see above); guardian emails are best-effort and not retried. Coaches,
  trainers and managers a guardian added keep their access after the athlete turns 18 until the athlete removes them.
- Account deletion keeps deal records (anonymized) and `deal_events` indefinitely; there's no retention schedule or
  admin/support tooling (e.g. fixing a wrong birth date, restoring an account, or a guardian deleting a minor's account).
  Invites addressed to an old email don't follow an email change. Sessions show start/expiry only (no device/IP). Authorization is enforced in app code (`requireAccess`); consider Postgres
  row-level security driven by `athlete_relationships` consent flags as defense in depth.
- Manager credentials are self-declared; `credential_verified` stays false until a verification flow exists.

- Study-session proof is a verification click by a guardian/manager; photo/document upload (needs object storage),
  school-system sync (Canvas/PowerSchool) and wearable sync aren't built. Meal logging is manual (no photo AI).
- Credentials (CSCS etc.) are self-declared and unverified — shown as such everywhere; there is no admin/verification
  flow, and nobody is treated as a Registered Dietitian yet.
- Dates use UTC (no per-user time zones); athletes can only complete a workout on its scheduled UTC day.
- No gym facility, team-registration, brackets, campaign-budget or collective-fund features — those dashboards show
  only what's real (deal pipeline, event listings).
- Dashboard rollups run a few batched queries per page load; fine for hundreds of athletes per viewer, not thousands.

## Next steps
1. More scheduled jobs (expiring offers/invites, session and token cleanup)
2. Credential verification and admin/support tooling (disputes, restoring accounts); file uploads for proof of study and form videos
3. SIS integrations (Canvas, Google Classroom, PowerSchool), OCR transcript upload
4. Wearable sync (Apple Health, Health Connect, WHOOP); AI food-photo macros
5. Video: guided drills, form-video upload and annotation
6. Legal review per state/association (SPARTA, NFHS, NCAA) before launch

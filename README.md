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

## Known gaps (do before real users)
- Set `APP_URL`, `RESEND_API_KEY` and `MAIL_FROM` for production; in production the app refuses to send without them (dev mode logs emails instead).
- Guardian links are one-to-one by email; there is no flow yet to add a second guardian, revoke a guardian, or
  re-link when an athlete turns 18 (consent should transfer to the athlete).
- Deals: no payment processing, e-signature or contract storage (the app records decisions, not a signed
  agreement); no counter-offers/edits (withdraw and re-offer); active deals can't be cancelled in-app; managers/agents
  can't act for athletes yet; the booster-to-high-school ban and other offer rules in `canOffer` are conservative
  defaults that need per-state legal review; no admin tooling to see/resolve disputed deals.
- No IP-level rate limiting (login, signup, reset and email change are limited per account only), no MFA.
- Guardian identity is only as strong as email control — nothing verifies that a "parent" is actually the athlete's
  parent. Any one guardian can remove another (logged and emailed, but there's no dispute/custody process). The "you're
  18" heads-up is an in-app notice for 30 days — there's no scheduler, so no email goes out on the birthday. Coaches,
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
1. Payments + e-signature for deals; messaging; a scheduled job (birthday emails, expiring invites/offers)
2. Credential verification and admin/support tooling (disputes, restoring accounts); file uploads for proof of study and form videos
3. SIS integrations (Canvas, Google Classroom, PowerSchool), OCR transcript upload
4. Wearable sync (Apple Health, Health Connect, WHOOP); AI food-photo macros
5. Video: guided drills, form-video upload and annotation
6. Legal review per state/association (SPARTA, NFHS, NCAA) before launch

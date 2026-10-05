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
- Email verification: a verified email is required before any dashboard page. Tokens are random, stored hashed,
  single-use, expire in 24h; the emailed link only shows a confirm button (the POST consumes the token, so link
  scanners can't burn it); resend is rate-limited to once a minute
- Guardian linking: a minor athlete's invite emails the guardian a 14-day single-use link. It's accepted only by a
  logged-in, **verified Parent account whose email equals the invited email** (claimed atomically), which creates the
  consent-flagged `athlete_relationships` row. Athletes see a "guardian approval needed" banner and can re-send
  (re-sending invalidates the old link). Parents see their linked athletes
- Sign-up captures role-specific data: athletes give sport/birth date (under 18 requires a guardian email); managers must declare their capacity (`manager_declarations`)
- 10 distinct role dashboards (`components/dashboards.tsx`)
- Role-gated nav and routes (`lib/roles.ts`, `requireAccess` in `lib/session.ts`)
- Development modules: Academics, Nutrition, Training, Compliance (`app/dashboard/*`)
- Tested domain rules in `lib/calc.ts`: BMR/macros (no sub-BMR for minors), grade alerts, eligibility gate,
  missed-session alert, in-season high-school training restriction
- Postgres schema in `db/migrations/001_init.sql`
- Dashboard and development-module *content* is still mock (`lib/mock.ts`); only identity is real so far

## Known gaps (do before real users)
- **Password reset** is not built (the email plumbing for it now exists). Set `APP_URL`, `RESEND_API_KEY` and
  `MAIL_FROM` for production; in production the app refuses to send without them (dev mode logs emails instead).
- Guardian links are one-to-one by email; there is no flow yet to add a second guardian, revoke a guardian, or
  re-link when an athlete turns 18 (consent should transfer to the athlete).
- Deals are still mock: the guardian-approval *gate* on deals comes with the deal flow.
- No IP rate limiting, no MFA. Authorization is enforced in app code (`requireAccess`); consider Postgres
  row-level security driven by `athlete_relationships` consent flags as defense in depth.
- Manager credentials are self-declared; `credential_verified` stays false until a verification flow exists.

## Next steps
1. Password reset; guardian management (add/revoke, turning-18 consent transfer)
2. Replace mock data with DB reads/writes per role; deal flow with guardian approval for minors; messaging
3. SIS integrations (Canvas, Google Classroom, PowerSchool), OCR transcript upload
4. Wearable sync (Apple Health, Health Connect, WHOOP); AI food-photo macros
5. Video: guided drills, form-video upload and annotation
6. Legal review per state/association (SPARTA, NFHS, NCAA) before launch

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
- Sign-up captures role-specific data: athletes give sport/birth date (under 18 requires a guardian email,
  stored as a **pending** invite that grants no access); managers must declare their capacity (`manager_declarations`)
- 10 distinct role dashboards (`components/dashboards.tsx`)
- Role-gated nav and routes (`lib/roles.ts`, `requireAccess` in `lib/session.ts`)
- Development modules: Academics, Nutrition, Training, Compliance (`app/dashboard/*`)
- Tested domain rules in `lib/calc.ts`: BMR/macros (no sub-BMR for minors), grade alerts, eligibility gate,
  missed-session alert, in-season high-school training restriction
- Postgres schema in `db/migrations/001_init.sql`
- Dashboard and development-module *content* is still mock (`lib/mock.ts`); only identity is real so far

## Known gaps (do before real users)
- **Email verification and password reset** are not built. Because emails are unverified, guardian invites do not
  auto-link to a parent account; verified linking is what unlocks guardian approval of deals.
- No IP rate limiting, no MFA. Authorization is enforced in app code (`requireAccess`); consider Postgres
  row-level security driven by `athlete_relationships` consent flags as defense in depth.
- Manager credentials are self-declared; `credential_verified` stays false until a verification flow exists.

## Next steps
1. Email verification + password reset, verified guardian linking
2. Replace mock data with DB reads/writes per role; deal flow with guardian approval for minors; messaging
3. SIS integrations (Canvas, Google Classroom, PowerSchool), OCR transcript upload
4. Wearable sync (Apple Health, Health Connect, WHOOP); AI food-photo macros
5. Video: guided drills, form-video upload and annotation
6. Legal review per state/association (SPARTA, NFHS, NCAA) before launch

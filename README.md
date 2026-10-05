# LIN — NIL Ecosystem

A sport-agnostic NIL platform where every role (athlete, parent, coach, trainer, gym owner/organizer,
sponsor, booster, tournament manager, recruiter, manager/agent) gets a **different dashboard** built for
its own needs, plus an Athlete Development & Representation OS (academics, nutrition, training) with
built-in regulatory guardrails.

## Run
```
npm install
npm run dev        # http://localhost:3000
npm test           # domain logic (lib/calc.ts)
npm run typecheck
```

## What exists now
- Role login (demo cookie, **not real auth**) and 10 distinct role dashboards (`components/dashboards.tsx`)
- Role-gated nav and routes (`lib/roles.ts`, `requireAccess` in `lib/session.ts`)
- Development modules: Academics, Nutrition, Training, Compliance (`app/dashboard/*`)
- Tested domain rules in `lib/calc.ts`: BMR/macros (no sub-BMR for minors), grade alerts, eligibility gate,
  missed-session alert, in-season high-school training restriction
- Postgres schema in `db/schema.sql`
- All data is mock (`lib/mock.ts`)

## Next steps
1. Real auth + DB (e.g. Supabase/Postgres) using `db/schema.sql`; row-level security driven by `athlete_relationships` consent flags
2. Deal flow with guardian approval for minors; messaging
3. SIS integrations (Canvas, Google Classroom, PowerSchool), OCR transcript upload
4. Wearable sync (Apple Health, Health Connect, WHOOP); AI food-photo macros
5. Video: guided drills, form-video upload and annotation
6. Legal review per state/association (SPARTA, NFHS, NCAA) before launch

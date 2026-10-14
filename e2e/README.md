# Local verification

Unit tests: `npm test`. Typecheck: `npm run typecheck`. Production compilation: `npm run build`.

## Portable suites

Use a **disposable local PostgreSQL database whose name ends in `_e2e`**. Integration and browser suites truncate users and related records. Run database suites sequentially; never point them at real data.

```sh
export E2E_DATABASE_URL=postgres://YOUR_LOCAL_USER@127.0.0.1:5432/lin_e2e
DATABASE_URL="$E2E_DATABASE_URL" npm run db:migrate
npm run test:integration
npx playwright install chromium
npm run test:app
```

Keep the test app running and execute one suite at a time in another terminal with the same `E2E_DATABASE_URL`:

```sh
npm run test:e2e
npm run test:e2e:admin
npm run test:e2e:settings
npm run test:e2e:operations
```

These run e2e18 (ordinary MFA), e2e17 (admin MFA), e2e6 (settings/deletion), e2e19 (connected operations, signing, schedule, travel), e2e20 (rate limits; start the app with `E2E_TRUST_PROXY=1`) and e2e21 (passkeys, via Chromium's virtual authenticator). Do not edit project files while a browser suite runs against `next dev`: a hot reload mid-test remounts client forms and produces false failures. The app defaults to localhost:3113 and writes disposable development mail to `.test-output/mail.log`. `E2E_BASE_URL`, `E2E_MAIL_LOG` and `E2E_CHROMIUM_PATH` can override those defaults. `psql` must be on PATH. The runner clears real payment/mail credentials. MFA uses the development fallback key; never use it in production.

Playwright is now a project dependency. The older cloud sandbox can still use `ln -sfn /opt/node-tools/node_modules e2e/node_modules` if needed; normal local installs do not need that symlink.

The two old e2e6 assertions (Postgres boolean formatting and SQL precedence) are fixed. Latest passing counts are recorded in `docs/GEMINI_REVIEW_HANDOFF.md`. Test output is local and ignored by Git; do not publish mail logs containing test tokens.

## Legacy suites

Ported to `runtime.mjs` and passing on this branch; see the "Legacy browser suites" section of `docs/OPERATIONS_IMPLEMENTATION.md` for counts, env and the behaviour changes they surfaced (Forg3 signing order, recent-MFA for money decisions, per-IP rate limits cleared per suite).

Coverage: e2e auth; e2e2 verification/guardians; e2e3 deals; e2e4 real data; e2e5 reset; e2e7 guardians; e2e8 jobs (phase 2 with a failing mail key); e2e9–11 mocked payments; e2e12 messaging; e2e13 notifications/admin; e2e14 safety; e2e15 news; e2e16 social/music.

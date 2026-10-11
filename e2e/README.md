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

These run e2e18 (ordinary MFA), e2e17 (admin MFA), e2e6 (settings/deletion), and e2e19 (connected operations/signing). The app defaults to localhost:3113 and writes disposable development mail to `.test-output/mail.log`. `E2E_BASE_URL`, `E2E_MAIL_LOG` and `E2E_CHROMIUM_PATH` can override those defaults. `psql` must be on PATH. The runner clears real payment/mail credentials. MFA uses the development fallback key; never use it in production.

Playwright is now a project dependency. The older cloud sandbox can still use `ln -sfn /opt/node-tools/node_modules e2e/node_modules` if needed; normal local installs do not need that symlink.

The two old e2e6 assertions (Postgres boolean formatting and SQL precedence) are fixed. Latest passing counts are recorded in `docs/GEMINI_REVIEW_HANDOFF.md`. Test output is local and ignored by Git; do not publish mail logs containing test tokens.

## Legacy suites

Other scripts still use cloud-specific paths and database commands. Their previous results are historical, not current verification of this branch. Port their runtime before running outside that sandbox.

Coverage: e2e auth; e2e2 verification/guardians; e2e3 deals; e2e4 real data; e2e5 reset; e2e7 guardians; e2e8 jobs; e2e9–11 mocked payments; e2e12 messaging; e2e13 notifications/admin; e2e14 safety; e2e15 news; e2e16 social/music.

Historical e2e4 expectations and the e2e3 listing timing flake need fresh investigation. Real Stripe and email-provider integration have not been verified by the local mock suites.

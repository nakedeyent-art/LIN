# NIL / LIN app improvement plan

Reviewed 2026-10-10 against `nakedeyent-art/LIN`, starting commit `2babd80`. Changes are local on `codex/security-and-app-improvements`.

The first priority is protecting account recovery, financial decisions, and minors. The app already has useful building blocks: server-side authorization, guardian-aware access, immutable agreements, payment idempotency, private downloads, and audit trails. Improvements should extend those controls consistently across all entry points.

The linked Claude conversation could not be accessed from this environment. This plan uses the actual repository, its README and handoff, and the user-provided MFA summary. It does not claim that the full conversation or a deployed installation was inspected.

## MFA policy implemented in this branch

Require MFA based on the operation a person is allowed to perform, including adult athletes and guardians. A role name alone is not an adequate boundary.

| Person / operation | Requirement |
| --- | --- |
| Admin panel | Keep mandatory MFA and the existing eight-hour verification limit. |
| Admin recovery of another account; retrying a payment | Password and reason remain required, plus MFA verified within ten minutes. |
| Sponsor, booster, gym owner funding or completing a deal | Enrollment plus MFA verified within ten minutes. |
| Adult athlete or guardian selecting the payment recipient or starting payout setup | Enrollment plus MFA verified within ten minutes, in addition to existing eligibility rules. |
| Any authorized contract signer; guardian deal approval | Enrollment plus MFA verified within ten minutes. |
| Requesting or agreeing to a funded cancellation | Enrollment plus MFA verified within ten minutes. |
| Ordinary browsing, development tools, messages, and social features | Optional MFA for non-admins; an enrolled account must always finish MFA at sign-in. |
| After an admin support reset | Password sign-in permits re-enrollment only. No dashboard or private file access until enrollment finishes. |

Verification returns the person to the original page to review and submit the action. It never automatically replays a payment, signature, or approval. Non-admins can disable MFA, which signs out other sessions; they must enroll again before any protected financial operation. The ten-minute interval is a product default, not a claim of regulatory compliance.

This action-based choice follows the distinction between authentication and authorizing a sensitive operation described by [OWASP transaction authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html). A future version can bind a short-lived authorization to the exact amount, recipient, and contract version for stronger transaction assurance.

## Implemented improvements

- Atomic MFA enrollment/disable, with other sessions revoked in the same database transaction; concurrent setup requests cannot overwrite an enrolled secret.
- Support recovery requires re-enrollment, and the admin must have recently completed MFA.
- Recovery codes remain usable when a stored authenticator secret cannot be decrypted. Revoked or expired sessions cannot consume codes or enroll factors.
- Expired password and MFA lockouts start a new attempt budget; the first typo no longer immediately starts another full lockout.
- Revoking admin rights preserves the account's second factor and ends existing sessions.
- Payout-link refresh uses the same POST action, age/guardian eligibility, and recent-MFA checks as initial setup.
- Payment recipients are checked and updated under database locks. A destination cannot change after a transfer attempt, refund processing, or settlement. A release waiting for a valid payee with zero attempts can still be repaired. Changes are recorded in deal history.
- Offer titles and deliverables use the existing youth-safety and payment-language screening. The open-offer limit is enforced under a transaction lock, including simultaneous submissions.
- MFA inputs have visible labels; recovery-code copy failures give an actionable message. Password-manager and code-paste support remain available, consistent with [W3C accessible-authentication guidance](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html).
- Portable local runners for the ordinary MFA, admin MFA, and account-settings browser suites, plus a guarded PostgreSQL integration suite. The two documented settings-test assertion errors are corrected.
- Updated test dependencies and a compatible PostCSS override resolve the dependency advisories reported during this review, without changing the app's Next.js major version.

- News fetch transport now connects to the validated DNS address, preserves Host/TLS hostname validation, revalidates redirects and bounds response sizes/time. Transport integration checks cover private redirect denial and bounds.
- Connected operations, document/signing, deal evidence, tasks, private scouting, and new-domain export/retention are implemented; see `OPERATIONS_IMPLEMENTATION.md` for actual coverage and remaining gaps.

## Next priorities

These are proposed increments, not features already built. Effort is relative and assumes the current codebase; provider integrations and policy decisions can change it.

| Priority | Opportunity | Why it matters | Concrete next deliverable / acceptance condition | Effort |
| --- | --- | --- | --- | --- |
| P1 before public launch | Distributed abuse controls | Per-account lockouts do not limit account creation, password spraying, or repeated requests across accounts. | Shared rate limits for login/signup/reset, MFA and reports; trusted-proxy configuration; observable throttling; no unlimited account-wide lock extensions caused by one remote actor. | Medium |
| P1 before public launch | Real provider verification | The handoff reports mocked payments, mail, and news. | Stripe test-mode funding, transfer, refund, dispute and duplicate/out-of-order webhook checks, plus real email delivery and retry checks. Use isolated provider test accounts. | Medium |
| P1 before public uploads | Quarantined uploads and moderation | File signatures and metadata removal are not malware or content screening. | Private object storage, pending/approved/rejected scan states, scanning failures deny access, reporting and moderator review, tested deletion/retention. | Large |
| P1 before public launch | Recovery procedure and reliable security notices | A password and a written reason do not prove a customer's identity; emails currently use best-effort sends. | Document evidence required for identity checks; restrict support permissions; consider second approval for high-value recovery; transactional notification outbox with retry and delivery visibility. | Medium |
| P1 before public launch | Domain-expert validation | Contracts, paying minors, eligibility, and nutrition affect users beyond software behavior. | Qualified review of contract terms, jurisdiction/association rules, payment/tax handling, youth consent, and nutrition recommendations; record what is validated versus assumed. This review makes no compliance determination. | External |
| P2 | Passkeys and multiple authenticators | Reduce phishing exposure and recovery friction. | WebAuthn enrollment and sign-in with verified user verification, explicit credential management, and a second backup authenticator; test origin/RP ID/challenge/replay checks. | Large |
| P2 | Better device/session controls | Users currently see session dates but have limited context or individual revocation. | Device/browser labels, last activity, per-session revoke, optional new-device notices, bounded pending-login challenges, and session-ID rotation on MFA completion. Minimize retained device data. | Medium |
| P2 | Deal workflow and payment clarity | Important approvals and payout problems can be hard to track. | A next-action queue for each role; due dates and reminders; deliverable evidence; explicit funding/held/releasing/paid/refunding states; a support reconciliation workflow for uncertain transfers. | Medium |
| P2 | Guardian safety center | Families need a single view of authority and exposure. | Current guardians, followers, discoverability, blocked users, active deals and access grants in one place; clear explanation of the age-18 transition; no broader default sharing. | Medium |
| P2 | Scoped moderation and appeals | Full admins are too broad a role for routine content review. | Report queues, restricted moderator permissions, case history, an appeal path, and audited, minimum-context access. | Medium |
| P2 | Complete data export and retention | Export fields lag behind messaging, social, payments, and MFA additions. | Inventory personal-data tables; expand exports without revealing other users' private data; define retention/deletion rules for agreements and audits; test each new schema addition. | Medium |
| P2 | Reproducible CI and observability | Legacy suites are sandbox-specific; failures and provider retries need visibility. | Port remaining browser suites; CI with fresh Postgres and migrations; production build gate; structured error and retry metrics; fix remaining e2e4 expectations rather than accepting permanent failures. | Medium |
| P2 | Accessible and mobile-friendly forms | Placeholder-only inputs and lost drafts create unnecessary friction. | Audit high-use forms with keyboard/screen-reader checks; visible labels, useful error summaries, preserved drafts, focus after validation, and measured mobile layouts. | Medium |
| P3 | Counteroffers, terms versions and deliverable tracking | Supports real negotiations and reduces off-platform coordination. | Explicit state-machine transitions, immutable accepted terms, guardian approval for changed terms, and notification controls. | Large |
| P3 | Verified professional status | Trainer/manager credentials are currently self-declared. | Clear self-declared versus verified labels, an evidence-review workflow, and expiry/revocation of verified claims. | Medium |
| P3 | Relevant discovery and notifications | Role-specific dashboards can become more useful without collecting more sensitive data. | Saved athlete/team/news filters, useful empty-state actions, digest preferences, and outcome metrics; keep minors' discovery rules intact. | Medium |

Passkeys should use a maintained WebAuthn library and require server-verified user verification when used to meet MFA policy. They do not fix weak account recovery or a compromised session by themselves. See [OWASP passkey guidance](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html).

## Suggested sequence and measurement

1. Review and ship this branch after its migration and tests. Start observing MFA setup completion, verification failure categories, recovery requests, and financial-step abandonment. Never record codes, secrets or form bodies in analytics.
2. Close the public-launch priorities: distributed limits, provider tests, upload quarantine, recovery operations, and specialist review.
3. Add passkeys, session controls, the role-specific next-action queue, and the guardian safety center. Measure time to complete a deal, stalled approvals, payout retries, and support requests per active user before and after.
4. Add richer negotiations and integrations once payment and moderation operations are dependable. Video and live music integrations should follow storage, licensing, safety, and operational work.

See `security_best_practices_report.md` at the repository root for code evidence and verification limits, and `e2e/README.md` for runnable checks.

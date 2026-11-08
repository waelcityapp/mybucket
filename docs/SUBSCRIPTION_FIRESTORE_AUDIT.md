# My Bucket — Firestore subscription authorization audit (STAGING ONLY)

**Status:** reviewed code; migration helper and candidate Rules prepared on preview branch, NOT deployed.

## Actual inspected paths
- Client Firestore: `src/lib/firebase.ts`; Firebase config selects a **named** database via `VITE_FIREBASE_DATABASE_ID`, with repository fallback `ai-studio-mybucket-8e5dde08-9b53-4f81-a3e3-2a1d3dd68642`. The exact production runtime database must be reconfirmed; never assume (default).
- Admin Firestore: `server/firebaseAdmin.ts`, optionally `FIREBASE_ADMIN_DATABASE_ID`. Gateway checks consistency with browser database ID.
- Trial settings: `appSettings/subscriptionTrials`: `proDays`, `basicDays` int. Setting is server-owned.
- Legacy billing: `users/{uid}/billing/subscription`: `trialStartedAt`, `paidExpiresAt` are ISO strings; `isPaid` bool. Some users have no billing document and rely on Firebase Auth metadata.
- Current authorization in Firestore Console rules supplied by owner: user-owned finance writes, irrespective of entitlement. Repository `firestore.rules` is different, and neither should be assumed to be active without verification.

## Prepared safe access schema
`users/{uid}/billing/access` (server-owned, read-only to the account owner):
- `registeredAt`: Firestore Timestamp from **Firebase Authentication user.metadata.creationTime**. No browser-provided date.
- `paidUntil`: Firestore Timestamp or null, copied only from server-owned billing with `isPaid===true` and valid `paidExpiresAt`. No payment activation here.
- `schemaVersion: 1`, `syncedAt`: Timestamp. No financial records, balances, or client profile data altered.
- The authenticated `subscription.trialSettings` gateway read bootstraps/refreshes access for the signed-in uid. Existing users who have not reopened the app will not yet have an access document, **so never deploy restrictive Rules before preflight/backfill verification**.
- Per-user duration exceptions remain a future requirement. Basic duration controls global finance-write access; the Pro trial duration controls the selectable Basic/Pro window and the Gemini entitlement.

## Preflight and migration checklist (not yet run on live database)
1. Verify exact Firebase project and named database, compare Rules shown in Firebase Console to approved candidate.
2. Back up current Rules and export Firestore before modifying production. Ensure owner can restore.
3. Read-only inventory of Auth users and matching billing/access docs; validate registration timestamps and distinguish missing/malformed billing/paid terms. Do not log finance content.
4. Backfill trusted `billing/access` for all existing Auth users via Admin SDK with a dry-run and counts, in small batches. Reconcile with Firebase Auth creation time; do not reset original registration or billing data.
5. Validate configured global settings document exists; avoid applying default `75` if owner has changed it.
6. Run `tests/firestoreSubscriptionRules.test.mjs` with Firebase Emulator and verify all cases. The test file is not in the regular npm build because Emulator and `@firebase/rules-unit-testing` are not installed in the current project.
7. Test signed-in account flows end-to-end on the **correct named database** in isolated preview/dev environment (new and old user, read-only expired, paid, profile/category, add/edit/delete, linked account balance and transaction atomic operations).
8. Only then publish Rules with explicit owner approval and confirm no production write failures or existing-data read failures. Rules changes may take time to propagate.
9. Snapshot/audit security logs and keep rollback copy. Missing access record blocks writes by design; detect and repair such accounts server-side.

## Known risks
- Firebase Admin SDK bypasses Rules. Gateway endpoints must enforce permissions on *any* financial writes.
- Client still displays a fallback subscription status from Auth when no billing record exists; that alone is not a database authorization.
- Firestore Rules on financial subcollections must cover both transaction and balance updates to prevent partial writes.
- The global `basicDays` applies to new and existing accounts at request time; any policy change takes effect on the next write.
- The rule draft is NOT deployed, NOT tested against a running emulator yet, and is intentionally in `firestore.subscription-draft.rules` rather than the production `firestore.rules`.


## Work started on this preview branch (2026-11-08)

- Restricted `ai.interpret` in both Vercel `api/gateway.ts` and local `server.ts`: Gemini is allowed only during the Pro trial stage or an active paid Pro subscription. Basic requests are rejected by the server because Basic must use the local analyzer.
- Updated `VoiceNaturalInput` to route selected Pro trial/paid Pro users to `geminiClient` and Basic users to `aiClient` (the deterministic local interpreter). Removed obsolete localStorage AI quota checks.
- Added server-authoritative daily quotas in `server/aiQuota.ts`: Basic local 10/2, Pro Gemini 15/5, and Pro local fallback 30/10 by default; all six limits are admin-configurable and counters are stored per user/day in Firestore.
- Added atomic reservation and fallback from exhausted/failed Gemini to the separately limited Pro local analyzer. Basic never calls Gemini.
- Updated the local query history range selection to distinguish Basic from Pro.
- Updated `firestore.subscription-draft.rules` to allow-list client-editable profile fields, reject client-supplied role/admin/entitlement fields, validate legacy marketer codes, preserve server-owned suspension fields, and deny client deletion of the profile.
- Extended the Firestore emulator tests with profile escalation/deletion cases.

## Policy and implementation gate

- Free-period financial writes are allowed only until the admin-configured total Basic period expires; after that the intended behavior is read-only, with all previous financial data preserved.
- The current policy helper retains the admin-configured Pro period followed by the admin-configured Basic free period. New accounts default to Pro; users can switch between Basic and Pro during the Pro trial window. After that window, Basic continues until the admin-configured total free-period end date.
- The selected plan is stored server-side in `users/{uid}/billing/subscription.selectedPlan`. Switching does not change `trialStartedAt` or reset daily quota buckets. Server quota reservation and Gemini access use the stored plan, not a browser-supplied plan.
- Existing subscription documents missing `selectedPlan` are safely defaulted to Pro by the authenticated subscription bootstrap.
- Do not deploy the draft Rules until the plan-switching policy, all Firestore paths, and Emulator tests are verified.

## Verification status

- Changes are committed only to `subscription-firestore-security-prep`.
- No production Rules, Firestore documents, Auth users, Vercel production deployment, or `main` branch were changed.
- Emulator tests and a full TypeScript/Vercel build have **not** yet been executed.

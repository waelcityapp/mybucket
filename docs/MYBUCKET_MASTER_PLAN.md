# MyBucket — Master Implementation Plan

This file is the durable source of truth for the MyBucket project. Update it after every approved phase so work can continue safely across new conversations.

## Repository and workflow

- Repository: `waelcityapp/mybucket`
- Production/work branch: `main`
- The product is still pre-launch, so approved changes may be made directly on `main`.
- Before each implementation: inspect the latest `main` and list the files that will change.
- After each implementation: run TypeScript validation and a production build before pushing.
- Preserve unrelated code and never replace the repository wholesale with an exported prototype.
- Increment the revision only with a tested GitHub upload and display it only to the approved administrator.
- Major workflows use full routed pages; modal dialogs are reserved for small confirmations and minor choices.
- Registration and sign-in are Google-only.
- All product backend operations use the single authenticated `POST /api/gateway` endpoint.

## Google AI Studio reference export

- Original filename: `my-bucket.zip`
- Size: `750806` bytes
- SHA-256: `3a89c7a8c76c71b61efede91e8a12624d3c2a9aa9fc546bd9c381653ab349920`
- Export date: 2026-09-22
- Purpose: design and product-behavior reference only. Do not overwrite `main` with this archive.

### Useful prototype concepts to selectively rebuild

- 10-day base trial and 35-day trial after a valid marketer code.
- Subscription status card and remaining-days indicator.
- Daily AI allowances: 15 smart entries and 5 smart inquiries.
- Dedicated sign-in/onboarding page.
- Home financial overview and quick transaction confirmation.
- Offers and discounts area.
- AI operations dashboard and model routing controls.

### Prototype problems that must not be copied

- Marketer codes and plan rules were exposed in client-side source code.
- Users could write their own billing/subscription documents.
- AI usage was stored in local browser storage and could be reset.
- Gemini usage numbers and model switching were simulated, not connected to the server.
- Prototype offers contained placeholder partners and links.
- The export does not contain the current admin-only page from `main`.

## Agreed business rules

### Trial and marketer codes

- A new account starts with a 10-day free trial.
- A valid marketer code changes the total trial period to 35 days from the original trial start date.
- Applying a code does not restart the trial clock or restore already-used days.
- Each account may apply at most one marketer code.
- Codes are validated only on the server and are never shipped in the browser bundle.
- Subscription status and paid flags are server-owned data; clients may read their own status but cannot write it.

### AI allowances

- Trial/free plan target: 15 AI-assisted transaction entries per day.
- Trial/free plan target: 5 AI-assisted financial inquiries per day.
- Manual entry and deterministic/manual search remain available after AI allowance exhaustion.
- Usage counters must be server-side and shared across all of the user's devices.

### Administration

- Admin email currently approved for the UI: `waelvts@gmail.com`.
- Sensitive admin operations must ultimately be verified on the server, not only hidden in the client UI.
- Marketers are promoted users with a unique code, active/inactive state, wallet, attribution, and commission ledger.
- A marketer-specific rule overrides the general marketer rule and may be scoped to a plan or offer.
- Pausing a marketer never deletes historical attribution or commission records.

### Backend and provider credentials

- The browser never calls Gemini or another paid provider directly.
- One server-side credential per external provider is stored in Vercel; never create a key per feature.
- New backend functions are validated actions inside `/api/gateway`, not new public endpoints.
- Firebase client configuration and Firebase Admin credentials are distinct, but all server secrets remain in Vercel and out of GitHub.

### Product navigation

- Authentication, subscriptions, marketer codes, admin, users, marketers, wallets, reports, transactions, and accounts are full pages with stable routes.
- Existing major modals are replaced incrementally when their feature is edited.
- Admin tools will manage users, subscriptions, marketer codes, allowances, AI routing, and operational reporting.

## Implementation phases

### Phase 0 — Durable plan and source preservation

- [x] Record the project rules, decisions, phases, and Google export fingerprint in this file.
- [x] Keep the Google export as a reference, not as a replacement for `main`.

### Phase 1 — Secure subscription foundation

- [x] Add server-side Firebase identity verification.
- [x] Create a server-owned 10-day subscription on first authenticated access.
- [x] Validate marketer codes from a protected Firestore collection.
- [x] Extend the total trial to the code-configured period (normally 35 days) from the original start date.
- [x] Prevent more than one marketer code per account.
- [x] Deny client writes to subscription and marketer-code records.
- [x] Route subscription and AI operations through one authenticated API gateway.
- [ ] Configure Firebase Admin credentials and matching Firestore database ID in the deployment environment. A live production gateway probe on 2026-09-24 returned `firebase_admin_not_configured` (HTTP 503).
- [ ] Seed the first real marketer code through an approved admin operation in Phase 4.

### Phase 2 — Authentication and subscription experience

- [x] Build the dedicated sign-in page with Google-only authentication.
- [ ] Verify responsive behavior on the deployed site; Google sign-in was tested by the project owner.
- [x] Support Google authentication only.
- [x] Allow marketer-code entry during Google onboarding and retry from the home subscription card.
- [x] Display plan status, trial expiry date, configured price, and remaining days.
- [x] Read an existing server-owned Firestore subscription as a fallback if the gateway fails; never invent trial days locally.
- [ ] Verify live subscription retrieval and code redemption after Firebase Admin credentials and a real marketer code are configured.
- [ ] Inspect and safely migrate any legacy subscription document from the Google export before establishing a fresh trial; preserve valid original start/expiry timestamps and do not treat client-authored marketer flags as verified entitlements.
- [x] Temporarily restore the Google prototype's remaining-days display by reading both legacy Firestore record shapes; if no record exists, anchor the 10-day display to Firebase Auth account creation time.
- [x] Temporarily accept the original prototype marketer codes and calculate 35 days from the original start. Save newly entered codes on the user's own Firebase profile after a successful write, then read them on subsequent visits. These are UI preview fields, not verified subscription entitlements.

### Phase 3 — Enforced AI allowances

- [ ] Record AI usage atomically on the server.
- [ ] Enforce daily smart-entry and smart-inquiry allowances across devices.
- [ ] Preserve unlimited manual entry and manual/deterministic searches.
- [ ] Integrate allowance checks with `/api/ai/interpret`.

### Phase 4 — Subscription and marketer administration

- [ ] Verify administrator privileges on the server.
- [ ] Manage users and subscription overrides.
- [ ] Create, pause, expire, and audit marketer codes.
- [ ] Configure trial length, discount, and redemption limits per code.
- [ ] Add marketer attribution and future commission support.

### Phase 5 — Real AI operations dashboard

- [ ] Record actual model, token usage, latency, success/failure, and fallback events.
- [ ] Configure primary and fallback models from protected server settings.
- [ ] Show real usage and estimated cost; link to official provider billing.

### Phase 6 — Selective design improvements

- [ ] Review and selectively rebuild the home financial overview.
- [ ] Review and selectively rebuild quick transaction confirmation.
- [ ] Improve mobile, desktop, Arabic RTL, and English LTR layouts incrementally.

### Phase 7 — Real offers and advertising

- [ ] Replace prototype offers with database-driven real offers.
- [ ] Add admin management, validity windows, links, and coupon rules.
- [ ] Define visibility for trial, free, and paid users.

### Phase 8 — Payments and launch readiness

- [ ] Integrate the selected payment provider.
- [ ] Activate and renew paid subscriptions securely.
- [ ] Apply marketer discounts and commission accounting.
- [ ] Complete security, mobile, regression, and production-readiness testing.

## Current implementation status

- Current admin-only revision: `#12` (Google reference UI restored by owner request, retaining Google-only authentication and existing Firebase/backend connections).
- Admin-only UI page exists on `main` and is visible to `waelvts@gmail.com`.
- Phase 1 provides the protected backend foundation; Phase 2 now includes Google onboarding, marketer-code entry, and the home subscription status and remaining-days card.
- Vercel build and the gateway runtime's unauthenticated 401 response were verified. Firebase Admin deployment credentials and a real marketer code remain unverified, so the signed-in days counter and redemption still need end-to-end testing.
- The Google export was inspected: its sample marketer codes were validated in the browser and its prototype saved `users/{uid}/billing/subscription` from the client. Old records may exist in the custom Firestore database; their schema uses `tier` and `discountPricePerMonth`, and the Google login handler could also save an `updatedSubscription` wrapper. Preserve any real timestamps during migration.
- Next planned work: add Firebase Admin service account credentials and the matching custom Firestore database ID in Vercel, redeploy, inspect the signed-in user's existing subscription document, then verify real marketer-code redemption.
- The owner deferred backend work. The UI reads the original Firestore subscription directly and calculates remaining days from its dates. The original Google sign-in code accepted a marketer code visually but used stale React auth state during its save callback, while the Firestore save helper swallowed write errors; therefore a previously accepted code may never have been persisted. The existing record may contain only a 10-day trial. For now, re-entering that code writes `prototypeAffiliateCode` to the owner's `users/{uid}` profile; the UI recalculates 35 days from the original trial start and reads it across devices. Treat this client-writable profile field only as prototype display state; never use it to authorize paid features or migrate it as a verified redemption. Before launch, restore server-side code validation and atomic redemption.


## Owner-directed Google reference restoration — 2026-10-25

This section supersedes the selective UI rebuild plan above. The owner explicitly requested restoring everything from the Google export before starting further changes. The source archive `my-bucket.zip` was recovered and its SHA-256 verified against the fingerprint recorded above.

Restored the exported home financial overview, sponsored banner and deals, quick transaction confirmation, subscription card, usage display, account/category/transaction/search screens, settings and original visual styling. Preserved the owner's Google-only authentication requirement, the existing administrator page and administrator-only revision counter, existing Firebase configuration, database contents, deployed rules, provider credentials and authenticated API gateway. No Firebase data or deployed rules were changed during this restoration.

Compatibility differences from the archive:

- Restored subscription UI types are isolated in `src/types/prototypeSubscription.ts`; the gateway retains its current contract.
- `src/services/prototypeSubscriptionClient.ts` adapts existing Firebase records and saved prototype marketer codes to the original UI. Existing trial start/expiry timestamps are preserved. Missing subscription records use the stable Firebase account creation time through the existing client, not the current date.
- The original Google login code saved a result wrapper and relied on stale React auth state. The restored login callback now passes the actual signed-in UID and waits for code persistence. Subscription-card success is shown only after saving succeeds.
- The original exported daily quota callbacks passed a usage object where the helper expects a user ID; callbacks now use the signed-in UID and load that user's saved daily counts.
- The exported history-limit property typo is corrected. Removing an already-recorded affiliate code remains blocked by the existing one-code account rule; the restored UI shows the actual save error instead of a false success.
- Original email/password login options were omitted to preserve the Google-only agreement. Existing backend/AI transport is preserved rather than restoring the export's obsolete endpoint.
- Deals and the AI operations dashboard retain their original sample/simulated content; this restoration does not turn them into live partner offers or actual provider telemetry. The dashboard remains administrator-only.

Validation: TypeScript check and production build passed. Server health returned HTTP 200; an unauthenticated gateway request returned HTTP 401. Static React rendering checked Arabic/English Google-only sign-in, financial overview and subscription/code display. Logic checks covered 10-day trials, a code granting 35 days from the original start (31 remaining after four elapsed days), invalid and duplicate codes, and user-scoped daily usage. Browser visual/mobile checks were blocked: no Chromium binary was installed and the browser download returned an invalid archive. No live Google sign-in or authenticated production database operation was performed.

Next work: the owner reviews the restored interface first, then requests individual changes. Backend completion stays deferred as requested.


## Subscription badge read fix — revision #10, 2026-10-25

The owner reported the home badge stuck on loading after restoration. The adapter discarded Firestore snapshot payloads and started fresh server reads; any failed read only logged an error, leaving the subscription null indefinitely. It now resolves the two delivered billing/profile snapshots directly, including metadata-only cache-to-server changes. Confirmed missing records use the stable Google account creation timestamp; cache-only missing records do not create a new trial. Original ISO dates, Firestore Timestamp values, and the legacy result wrapper are supported. Persisted prototype marketer codes still calculate 35 days from the original start.

The badge displays remaining trial days or `انتهت التجربة` / `Trial expired` at zero days. While the first records are being read, no indefinite loading badge is shown. Failed reads/timeouts produce an explicit retry action rather than an invented expiry; subscriptions can still recover from later listener updates. The subscription listener is separate from financial-data listeners, so retries do not resubscribe or reseed accounts. No live records, Firebase rules, backend transport, or settings were modified.

Validation for #10: TypeScript and production build passed. Mocked Firestore listener regression checks passed for direct snapshot reads without follow-up network requests or writes, 31 remaining days after four elapsed days with a saved marketer code, expired trial, ISO/Timestamp/wrapped legacy records, missing-cache versus confirmed-missing documents, listener errors and recovery, timeout retry, and unsubscribe cleanup. Live signed-in account and browser visual checks were not performed.


## Subscription diagnosis and independent billing read — revision #11, 2026-10-25

The owner's live account still reports a read error after #10. No signed-in owner session is available in this environment, so the actual Firebase error has not yet been observed. Do not claim a live fix based only on fixtures or a successful build.

The listener now accepts a valid billing record containing its own affiliate code or paid status without waiting for the unrelated profile listener. Profile failures do not block a self-contained billing record. A trial without a billing code still waits for the profile, so a saved prototype code is not silently ignored. No fallback days are invented after a denied billing/profile read.

Read failures are now distinguished by billing, profile, date parsing, or account change. The page shows a precise Arabic/English explanation. Only the administrator sees the underlying Firebase/local error code and, for invalid dates, the record's field names (no field values, credentials, or financial data). Timeouts are explicitly identified, and retry remains available. Firebase data, deployed rules, configuration and backend connections remain unchanged.

Next verification requires the owner's actual Firebase error or a successful signed-in read on #11. This remains a live-verification blocker, not proof that permissions or dates are the cause.

Validation for #11: TypeScript, production build, and regression fixtures passed. Checks include the original countdown/date/cache/cleanup cases, a complete billing record surviving profile permission denial, separate billing permission errors, exact invalid-date classification with field names only, no raw error values in UI diagnostics, and paid records resolving independently. Multiple failing read sources are retained in the administrator diagnostic. These checks do not establish the live owner-account error or prove it resolved.


## Header slogan — revision #12, 2026-10-27

Updated the Arabic header slogan to «تنظيم فلوسك أبسط مما تتخيل مع My Bucket» at the owner’s request. Layout, English copy, authentication, subscriptions and connections are unchanged.

Validation: TypeScript validation and production build passed. Header translation binding verified. No server behavior changed.


## Trial details and subscription pages — 2026-10-27

The owner approved dedicated pages for trial details and the monthly subscription. The home status opens /trial, and /subscription displays the regular or recorded-code price. Expired trials cannot be extended by entering a prototype code; subscription discount redemption and payment remain future work. No historical code is inferred when absent from the saved records. Existing Firebase configuration, rules, and user data are unchanged. Client-side checks are not secure entitlement enforcement; backend validation remains required before launch.


## Confirm subscription dates before display

Trial dates are shown as recorded only when obtained from a valid billing record without a profile-code derived expiry. Missing or inferred dates show an unconfirmed state, without inventing a trial duration. Display waits for server-confirmed Firestore snapshots. No user data or Firebase rules were modified. Historical attribution remains unresolved where not recorded.


## Financial save and account isolation — initial phase

Prepared a server-confirmed Firestore transaction for new financial entries, and removed shared local financial state from the active session. Account snapshots must be server confirmed before initialization. Validation used simulated Firestore and build checks; signed-in, multi-account, multi-device and concurrency checks remain required after deployment and before relying on the feature. Editing and deleting transactions and application locking are outside this phase and remain unverified. No legacy browser data or Firebase data was deleted.

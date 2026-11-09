# MyBucket — Master Implementation Plan

## Trial access bootstrap (November 2026)

- The five existing authenticated accounts received server-owned `billing/access` documents using their original Firebase Authentication registration times; a read-only audit confirmed five matching records.
- The authenticated `subscription.trialSettings` action ensures a missing access record exists before returning settings. Existing records are validated and never overwritten; an existing billing record without access requires review rather than an assumption about payment. Concurrent creation uses a Firestore transaction.
- Initial setup account saves and default category initialization wait for this bootstrap. Financial reads remain available while it runs.
- This does not deploy Firestore Rules or enable paid plans. Expiry enforcement on Firestore remains pending rule review, tests, and an approved rollout.

## Presence (November 2026)

- Signed-in foreground clients register an independent Realtime Database session for each browser tab or device. Firebase on-disconnect operations remove the session and record the last-seen time and approximate device type.
- The admin user list shows presence and device type when opened or manually refreshed, and last seen in Africa/Cairo time. Unknown devices are labeled as such. If realtime data cannot be read, presence is shown as unavailable; account suspension is separate.
- New versions no longer send the once-per-minute Firestore heartbeat. The older gateway action remains temporarily for already-open old app versions; legacy last-seen timestamps may be displayed without a device type.
- The dedicated Realtime Database rules are in database.presence.rules.json. Presence contains no financial details or individual actions. The realtime rules must be deployed before this app version, and no Firestore rule change is required.

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


## Manual transaction verification

Manual entry requires an explicit account and category. New transactions and balance changes remain atomic, followed by a server read to verify the exact saved transaction before reporting success. The transaction list distinguishes confirmed empty results from loading or read errors. Production Firebase and two-device verification remain pending; no user data or Firebase rules were changed. AI interpretation and querying are outside this phase.


## Cash expense balance check

A new cash expense is rejected inside the Firestore transaction when its amount exceeds the current saved cash balance; the form displays the account balance and no write occurs. Exact-balance expenses remain allowed. Rules for credit cards, other account types, transfers and historical edits are not changed by this request. Live Firebase verification remains pending.

## Balance checks for all accounts — revision #18

New expenses and transfers must not exceed the current server balance of their source account, regardless of account type. Income remains allowed. This applies to new transactions; existing balances and past transactions are not modified.

## Explicit financial account selection — revision #19

New operations require a user-specified source account. AI drafts cannot use a guessed or learned source; an unspecified source is selected in the transaction form. AI-created transfer drafts require explicit source and destination selections.

## AI transaction review — revision #20

AI-created transactions open a full review form at /transactions/new rather than a quick-save card. Users review and edit fields before saving; no financial transaction is created at interpretation time.

## Atomic transaction deletion — revision #21

Deleting a transaction atomically reverses its effect using current server balances: expenses return funds to their source; transfers return funds to the source and deduct them from the destination; income is reversed from its account. If reversal would overdraw an account or account data is invalid, deletion is rejected without changing balances or the record. Repeated deletion does not reverse twice.

## Atomic transaction editing — revision #22

Editing an existing transaction reverses its previous financial effect and applies the new one against current server balances in one Firestore transaction. Stale edits, insufficient funds, invalid accounts and currency mismatches are rejected without partial writes.

## Non-negative balances and legible negative values — revision #26

Account creation and balance edits reject negative or invalid balances. Existing negative balances remain unchanged and are labelled clearly for the user to review.

## Linked payment methods and credit cards — revision #27

New debit cards and wallets may be configured independently or linked to an existing bank account; linked methods display the bank balance without double-counting it. Credit cards have a credit limit and outstanding balance. Transaction records preserve the actual balance accounts so edits and deletions reverse the right records atomically. No direct banking connection is used. Existing accounts are not migrated automatically.

## Initial account setup — revision #29

When a signed-in user has no saved accounts, show a full-page setup for optional bank accounts and cash. Existing accounts are not overwritten or removed by this change. Google sign-in and subscription state remain separate.

## Account settings and usage guide — revision #32

The home screen links to account settings and a full-page usage guide. The guide is also accessible from initial setup and makes clear that saved trial entries are real application records; no financial reset is performed.


Revision #33: Account management exposes account creation and a confirmed reset of account balances. Reset updates balances atomically, preserves accounts and transaction history, and explains its impact on credit balances and later transaction edits.


## Administrator dashboard entry — revision #91

Move the owner-only dashboard shortcut into the Google avatar menu. A dedicated full-page PIN prompt is introduced without a new Vercel backend. For now PIN verification is client-side UX only and is **not an additional server-side security boundary**; Google administrator authorization remains mandatory on existing protected server actions. Failed-attempt limits and one-hour lockout remain deferred until secure server-side enforcement is available.


## Revision #92 — admin avatar link wiring fix

Corrects the admin entry callback binding on the authenticated Header (previously misplaced on AuthPage). Keeps existing PIN page and defers server-side rate limiting.


## Admin console organization — revision #93

Move the existing Gemini AI usage, server connection diagnostic and active model selection card from user Settings to the owner-only Admin dashboard. Keep feedback reports and rating controls under a clearly labeled dashboard entry, and return from Admin to Home instead of Settings. Existing data reset functions remain intact. No backend changes or new administration features are introduced.


## Admin navigation sections — revision #94

The existing administrator dashboard is organized into six selectable sections: Users, Subscriptions, Marketers, Reports, Artificial Intelligence, and System Settings. The first three are clearly marked in development with no fabricated user data or enabled admin controls. Reports opens the existing feedback administration page; AI preserves the existing Gemini usage, diagnostics, and model management widget. System Settings contains the existing diagnostics and current-account data tools, clearly labeled as personal-account operations. No server endpoints, billing rules, data models, Firebase or Vercel configurations are changed. Administrator PIN limitations documented previously still apply.


## Admin full-page navigation — revision #95

The owner dashboard now lists seven cards, adding Ads Management (not yet implemented). Every card opens its dedicated route rather than expanding beneath the grid. Reports goes directly to the existing `/admin/analyzer-feedback` route; AI and System settings retain their current working widgets, and the remaining sections show clearly marked development placeholders. The section Back control returns to `/admin`; browser/mobile history navigation is wired to admin routes. Google account gating and the existing temporary client-only PIN step remain unchanged. No backend, Firebase, ad data or deployment settings are changed.


## Public advertisement creation entry — revision #96

The green plus button beside the offers title is available to ALL visitors (not only administrators). It opens a full-page route `/offers/new`, separate from `/admin/ads` (owner-only advertisement moderation). Visitors can choose a free or premium advertisement, select its category, enter details, add local image previews, and review their draft. This is an interface-only workflow: no ad or image is uploaded or persisted, and no prices, payment, approval, or publishing services are invented. The form transparently explains that publishing is not available until a verified backend and policy are implemented. Existing public offers counts remain based on real published ads only, currently none.


## Context-aware fixed bottom navigation — revision #97

Keep the bottom navigation fixed and visible through both upward and downward scrolling on the main financial pages (Home, Transactions, Search, Categories, Settings and Accounts). Hide it during full-page workflows such as advertisements, login, subscription/trial, guides, admin pages, initial account setup, transaction creation and account editing, as well as open modal forms. Reserve extra bottom space only on screens that display the bar so the final content and controls are not obscured; retain safe-area inset padding. The bar's five existing actions and styling are preserved. No backend or financial data changes.


## User-only bottom settings navigation — revision #98

Rename the bottom navigation label from More to Settings in Arabic and English; it continues to open the existing user Settings tab, never the admin dashboard. Remove the redundant home-header Settings shortcut (which previously opened Accounts instead of user Settings), and reflow the remaining two shortcuts. Remove developer diagnostics from the public Settings page; equivalent technical diagnostics remain available in the owner-only Admin System section. Administrator access remains exclusively in the Google account avatar menu with existing account and PIN checks. Bottom navigation fixed-scroll behavior is unchanged. No changes to Firebase or backend authorization.


## Currency support — #99

19 currencies available in fixed account currency selectors, including first-run setup. The financial overview has a saved currency selector and its calculations are currency-scoped. Transaction filters are independent and results show separate totals by currency. Existing balances and transactions are not converted. Cross-currency transfers remain unsupported by the current balance engine; a future dedicated exchange-rate model is required.


## Transaction filters — revision #100

Transaction history displays separate controls for the date period and currency. The date group supports All dates, Today, This month, This year, Last year, and custom inclusive From/To dates; incomplete/invalid date ranges show an instruction and no misleading results. The currency dropdown has its own label and remains independent of date/type filters and the home overview currency preference. Existing quick links from Today's/Monthly spending continue to preselect the matching date and currency. No financial transactions or account records are modified.


## Transaction filter order — revision #101

Show the currency dropdown as the first control above the date period choices, followed by transaction type (income, expense, transfer, all). Rename the caption simply Currency / العملة, removing the confusing 'independent of period' wording. The three choices still compose as a combined filter; no changes to filter calculations or stored data.


## Persistently visible currency selector — revision #102

The financial overview always renders its currency dropdown even when there is only one account currency; opening it lists only currencies used by the user's actual accounts. With zero accounts it displays a disabled 'No currencies' placeholder. Choosing a currency continues to update all scoped indicators, without changing stored account balances or transactions. No other financial logic or presentation changes.


## Inline approximate currency comparison — revision #103

The third shortcut spot in the home greeting/plan row hosts a compact currency comparison card directly; no dedicated page. Default pair is EGP versus USD, with two separate drop-downs showing all 19 supported currency codes. The current approximate rate is fetched via the existing authenticated /api/gateway action (fx.get / fx.select), based on Frankfurter v2 daily reference rates cached centrally in Firestore; the provider date is shown and cached older values are marked. Each actual change to either selected currency counts toward a server-authoritative limit of ten per user per Cairo calendar day via a Firestore transaction, shared across devices. Users can still view the currently selected rate after hitting the quota. Pair preferences persist on the authenticated user record. The UI explicitly says rates are approximate and updated daily, with no promise of bank buy/sell accuracy. The values are strictly informational: no account balances, income, expenses, transfers or exchange rates in financial transactions are changed. Failure to retrieve rates must show an error, not a made-up value.


## Exchange rate display fallback — revision #104

Fixed a potential all-or-nothing reference fetch failure by requesting the complete Frankfurter v2 EUR quote feed and selecting supported codes afterward, rather than requesting every supported currency as an API filter. The server now logs upstream feed failures and returns a list of currently quoted currencies. If the authenticated gateway still fails, the home widget tries a read-only direct EGP/USD reference rate for information, clearly marks its temporary nature, and does not allow changing pairs or bypass the 10-per-user-per-day server limit. No fabricated rates and no financial data modifications. Verify the app's gateway and Firebase Admin environment separately if direct fallback displays persistently.


## Rates card layout redesign — revision #105

The rates widget is now the prominent larger card in the home quick-access area. The two existing User guide and Subscriptions buttons are stacked vertically beside it, rather than occupying equal-width columns. The rate is shown in stronger, larger type, with more spacing, rounded surface, daily approximate-rate disclosure and remaining-change badge. The feature remains inline on the home screen with the existing account-scoped daily exchange limits, same source and fallback; no financial transactions or balances changed.


## FX currency changes on production — revision #107

Root cause: the Vercel production API entrypoint `api/gateway.ts` did not register `fx.get` or `fx.select`, although local `server.ts` had those actions. This caused authenticated production requests to return `gateway_action_not_found` and forced the read-only direct EGP/USD fallback. Add the two production gateway actions using the existing verified Firebase identity. Preserve existing per-user, per-Cairo-day 10 actual pair changes limit, validated with an atomic Firestore transaction. UI dropdowns list only currencies currently provided by the daily reference feed. Default EGP/USD, informational-only values, daily timestamps, and no changes to actual financial balances or transactions. Deploy build validates compilation; actual logged-in gateway response and quota need user-session end-to-end verification.


## Uniform compact account cards — revision #108

On the Accounts screen, all account cards use the same compact 92px height, aligned with the previously smaller Cash and Visa examples. Replace flex wrapping with a fixed two-row layout: icon/account name/currency description above, balance and edit/delete actions below. Long names/descriptions truncate visually with a full title for hover, and large balances remain horizontally scrollable within the number area without stretching the card. Only an explicitly opened delete confirmation can extend its card height. All account data, balance calculations, permissions, editing/deleting handlers and storage are unchanged. Support Arabic RTL and English LTR, mobile single-column and desktop two-column layouts.


## Legacy optional accounts are user-deletable — revision #109

Removed old protections that prevented deleting the prototype accounts with IDs `acc_other` (Other Methods, often renamed to InstaPay) and `acc_extra` (Other Accounts). The Accounts UI enables deletion on these cards, and the Firestore client deletion routine now applies the same safeguards to all accounts: confirmed signed-in user, cloud-loaded account/transaction data, zero balance, no recorded transactions referencing the account as payment method, destination or actual source/destination balance account, no other account linked to it, and at least one remaining account to avoid unintended re-onboarding. The app no longer injects these two accounts into cloud snapshots, and the demo/default account template no longer includes them, so deletion is persistent across reloads. Existing accounts and balances are not removed or converted by this release; deletion happens only after user confirmation. Other/custom account types remain available for new user-created accounts. Firebase project, rules and storage are unchanged.


## Mobile home-screen installation — revision #110

My Bucket can be installed to the Android and iPhone home screen as a Progressive Web App on its existing HTTPS domain. Added a web app manifest with standalone display, theme color, Arabic/English-friendly identity and genuine 192/512 PNG app icons with an SVG favicon; iOS apple-mobile-web-app metadata and a 192px touch icon are provided. The minimal service worker is registered on load and only caches public install icon assets, never sensitive financial pages, authentication, Firestore or API responses. The existing mobile-access help dialog is repurposed into an install guide: browser-native install prompt when offered on supported Android browsers, otherwise manual Chrome instructions; Safari iPhone Share → Add to Home Screen steps; and detection of already-installed standalone mode. The previous obsolete AI Studio dev/shared URLs are removed; the copy-link feature uses the current website origin, including production or preview. Settings now labels the feature Install app. No Firebase rules, financial data, account workflow, subscriptions or backend gateway changes. Real-device Chrome and Safari installation must be confirmed separately; automated Vercel build cannot simulate OS home-screen installation.


## App users administration — revision #111

The admin dashboard now has a dedicated "مستخدمو التطبيق" card and full `/admin/users` view. Firebase Authentication is the source of truth for registered user count, names, email, creation date, last sign-in and account disabled status. Per-user billing subscription records supply free / trial / paid indicators and named plans only when actually stored; missing plan data is labeled unknown, not guessed. A registered user's installed-PWA signal is recorded only upon a browser `appinstalled` event or a standalone PWA launch after sign-in; server-side Firestore transaction counts a unique UID only once, with best-effort client-side de-duplication. This metric is not an exact count of devices, anonymous installs or installations before tracking. No normal page-view telemetry or polling is introduced.

Only the approved authenticated administrator can call `admin.users.list`, `admin.users.setDisabled` or `admin.users.deleteAuth` on the existing single production `POST /api/gateway`. The admin panel reads user records on demand on opening or explicit refresh (initially at most 200 rows, searching/filtering over displayed rows; counts are capped and explicitly identified beyond 5,000). Firebase Admin enables/disables accounts; disabling also revokes refresh tokens. Old Firebase client ID tokens may remain valid up to expiry, so old Firestore sessions cannot be assumed immediately terminated. Deleting a login identity requires a previously disabled user, rechecking the stored email on the server, entering the exact email in the UI, and a guarded Firebase Auth delete; user Firestore financial history is deliberately preserved, so this does NOT mean deleting all user data. The administrator's identity cannot be disabled or deleted; an audit event is recorded for destructive requests.

The on-device installer reports no financial information. Neither database configuration, Firestore rules, balances, payments, transaction records, nor paid plans are modified in this revision. Existing Firebase Admin credentials are reused; no extra Vercel API function/endpoint is added. Real admin listing, disabling and deleting should be verified with an authorized test account before relying on production operation; production build success proves compilation but not end-to-end Firebase console state.


## Revision #113 — subscription policy foundation (2026-11-07)

The requested introductory policy is 15 days of Pro trial followed by Basic through day 60 after original account registration. A marketer code discounts Pro but no longer extends either period. Basic's monthly price and feature entitlements are deliberately not approved yet. Pro remains EGP 180 monthly, EGP 120 with an eligible marketer code. A portable subscription-policy helper is shared between frontend and server; financial records continue to live in Firestore with cross-device synchronization. The subscription cards and administrator user labels reflect the new periods; the former Plus placeholder has been removed from the subscription choice screen. Legacy records retain their original start dates and are interpreted under the new policy without client-side billing writes; the authenticated server can migrate dated legacy billing when invoked. No automatic charging, account blocking, payment activation, financial-data migration or new Vercel function is introduced. Entitlement enforcement and the optional Basic/Pro comparison control are deliberately deferred until feature definitions and payment handling are approved. Validate tests and a preview build before promoting to main.


## Revision #118 — Firebase trial-days administration (implementation in preview)
Administrator-only `/admin/subscriptions` is wired through the existing authenticated API gateway to the Firestore `appSettings/subscriptionTrials` document. The verified owner account may change global Pro and Basic day counts (1–365, Basic no shorter than Pro); all users use the same settings and their original account creation date. Changes are audited in `subscriptionTrialsAudit`; Firebase retains every financial record. Browser reads settings once on login and again when the tab becomes visible; normal Firestore financial reads/writes are not sent through Vercel. While the new UI allows read-only testing of expired accounts and the AI gateway rejects expired calls, the financial write guard runs in client code. **It is not secure database enforcement until Firebase Firestore Rules are independently verified and deployed to the exact production database.** Do not assert server-side financial write protection or launch paid subscriptions on this basis. Pro/Basic feature distinction, payment activation and individual grants are deferred.


## Revision #119 — Gateway module resolution repair
Production runtime error `ERR_MODULE_NOT_FOUND` for `/var/task/src/config/subscriptionPolicy` in `server/subscriptionService.js` was identified through Vercel runtime logs. Two server imports were updated to explicit `.js` ESM paths so subscription and admin gateway actions can resolve the shared policy at runtime. The subscription durations, Firestore rules, and all user data are unchanged.


## Revision #120 — Subscription trial change history
The existing Firestore `subscriptionTrialsAudit` trail is exposed read-only to the authenticated owner via the existing gateway action `admin.subscriptionTrials.history`. The admin `/admin/subscriptions` page lets the owner click the last-update timestamp or open the change-history section to inspect each saved Pro/Basic day count before and after, with its timestamp. Only the latest 50 entries are returned (newest first), and no user financial data or subscription settings are modified by viewing history.


## Revision #121 — Archived audit entries and centered trial-expiry notice
Subscription trial history allows the owner to hide individual obsolete entries from the UI after inline confirmation; Firestore `subscriptionTrialsAudit` records remain retained with `archivedAt` and `archivedBy`. This only changes audit visibility, never plan durations. Expired-user manual, typed and microphone input attempts display a centrally positioned notice linked to the full subscription page; voice recognition is stopped on expiry. These are client UX safeguards, not a substitute for deployed Firestore Security Rules.


## Revision #122 — Bottom navigation brand green
Replaced blue active and hover colors in `src/components/BottomNav.tsx` with the existing emerald-green visual theme, including the elevated center Search button. Navigation behavior, layout, and financial functionality remain unchanged.

## User directory foundation — prepared for verification
The owner can prepare a server-managed `adminUserDirectory` from Firebase Authentication in pages of 100. Each page reads existing index records and writes only changed records. Account sign-in and admin disable/delete actions attempt to synchronize the index. This does not change financial records or Firestore rules. Directory counts are informational and do not prove identity-by-identity equality; concurrent account changes and synchronization failures require reconciliation. The existing user list, search and filters still cover only the most recent 200 records. Pagination and comprehensive search are future work; do not claim completion until the directory has been populated and verified against the live authentication source.

## Revision #131 — Directory search preparation
Directory synchronization additionally stores normalized search grams and a sortable registration date for later paged search. The current administration list remains unchanged. Existing accounts require one rerun of the owner directory preparation action. Search also requires a separate Firestore composite index before the later interface can be enabled. No financial records or database rules change.

## Revision #132 — Paginated administration directory
The user directory is queried in bounded pages, newest registration first, with substring search over the complete synchronized index and Cairo calendar date filters. User status filters scan candidate pages server-side; sparse filters may require loading more. The searchable Firestore composite index must be enabled and the directory synchronized before use. Financial data is not edited; only candidate account summaries are read. Directory totals may differ from Authentication when users are not synchronized.

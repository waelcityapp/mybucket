# MyBucket Project Constitution

These rules are mandatory for every conversation and every implementation in this repository.

## Repository and delivery

- Repository: `waelcityapp/mybucket`.
- The project is pre-launch; approved work may be committed directly to `main`.
- Before editing, inspect the latest `main` and state exactly which files will change.
- Preserve unrelated code. Never replace `main` wholesale with an exported prototype or generated project.
- After changes, run TypeScript validation, a production build, and relevant server checks before pushing.
- Update `docs/MYBUCKET_MASTER_PLAN.md` when a decision, phase, or implementation status changes.

## Revision counter

- The revision counter confirms the latest successfully tested commit uploaded to GitHub.
- Increment it only as part of a change that is tested and pushed to GitHub, never for an unpushed draft.
- Display the counter next to the greeting only for the approved administrator.
- The current administrator email is `waelvts@gmail.com`.
- Normal users must never see the revision counter.

## Authentication and authorization

- User registration and sign-in are Google-only.
- Do not add email/password authentication or guest access to protected data and AI operations.
- The client sends a Firebase ID token; the server verifies it for every protected operation.
- Hiding a button is not authorization. Sensitive admin operations must verify admin permission on the server.
- Prefer Firebase custom claims for durable admin/marketer roles, with the approved admin email as the bootstrap identity.

## Firebase and Vercel

- Reuse the existing Firebase project and Vercel project configuration.
- Inspect existing Vercel variables before asking for or creating new ones.
- Never store secrets in GitHub or in browser-visible `VITE_` variables.
- Firebase client configuration and Firebase Admin credentials serve different purposes; keep all server credentials server-only.
- Do not change Firebase storage, project IDs, or deployed rules without verifying the exact target first.

## Unified backend gateway

- All product backend operations use the single `POST /api/gateway` entry point.
- New features add a validated gateway action; they do not create a new public endpoint or a new frontend API key.
- The browser never calls Gemini or another paid provider directly.
- Keep one server-side credential per external provider in Vercel (for example one `GEMINI_API_KEY`), not one key per feature.
- The gateway is responsible for authentication, authorization, subscription checks, usage enforcement, provider routing, and safe errors.
- `/api/health` may remain separate as a non-product operational health check.

## Subscription and marketer rules

- New accounts receive a 10-day trial once.
- A valid marketer code changes the total trial to 35 days from the original registration/trial start date; it never restarts the clock.
- One account can apply at most one marketer code and cannot apply its own code.
- Codes and subscription mutations are server-owned and must not be shipped in client code.
- Marketers are promoted users with a unique code, status, wallet, attribution, commission ledger, and reversible active/inactive state.
- General marketer rules apply by default; a marketer-specific rule overrides the general rule and may be scoped to a plan or offer.
- Never erase historical attribution or commission records when a marketer is paused or reverted to a normal account.

## Full pages, not modal workflows

- Major workflows must be full pages with stable routes, browser history, and shareable links where appropriate.
- This includes authentication, subscriptions, marketer codes, admin, users, marketers, wallets, reports, transactions, and accounts.
- Use modal dialogs only for small confirmations or truly minor choices.
- Replace existing major modals incrementally when their feature is edited; do not rewrite all screens at once.
- Support mobile and desktop, Arabic RTL and English LTR, and light/dark modes when introduced.

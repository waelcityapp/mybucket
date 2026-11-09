# App Lock — deferred launch checklist

Status: **STAGED / DISABLED**. Configuration is committed to `main`; implementation and email recovery remain pending.
This staging change does not enable or expose the feature in the UI.

## Approved behavior
- Optional setting under Account Settings for Basic and Pro; off by default.
- User chooses and confirms a six-digit PIN.
- Require PIN before showing financial UI after Google sign-in, app reopening, or a configured 1/2/3 minutes of inactivity.
- Do not interrupt active interaction; changing/disabling lock requires the existing PIN.
- Forgotten PIN: one-time reset link delivered to the account's verified email, expiring after 10 minutes; notify on successful reset. Preserve all financial data.
- Keep Google sign-in and Firebase authorization unchanged.
- Treat the PIN as an extra privacy barrier, not a replacement for backend authorization.

## Implementation tasks before enabling
1. Implement server-only PIN hashing and verification (salted, memory-hard KDF), account-scoped settings, and throttling/lockout of failed attempts. Do not store PINs in Firestore documents writable/readable by the client.
2. Add authenticated gateway actions to set, verify, change and disable the PIN; ensure unlock state is bound to the authenticated UID and cannot be carried over after logout or account switch.
3. Add client lock gate **before** any financial view; avoid flashing cached balances while status loads. Recheck on reopen, reload, and inactivity; define PWA background behavior.
4. Implement secure single-use recovery tokens, hashed at rest, short TTL and attempt limits; reset links must not be reusable.
5. Configure Resend verified sender domain and server-side API key (never a VITE_ variable). Test actual email delivery and post-reset notification.
6. Validate the protection boundary: existing Firestore rules allow an authenticated user to read their own financial documents even when the UI is locked. App Lock therefore protects only casual on-screen viewing, not a signed-in browser with developer tools; do not claim otherwise.
7. Test Basic/Pro, Arabic/English, mobile/desktop, offline/error states, login/logout, reset expiry, brute-force controls, and build.
8. Only after successful recovery testing, explicitly approve enabling the feature and production deployment.

## Current dependency
User is on a temporary Vercel domain and elected to defer buying/verifying a custom domain. **Do not enable the setting** until email recovery works.

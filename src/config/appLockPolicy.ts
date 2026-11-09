/**
 * My Bucket App Lock — staged rollout.
 *
 * IMPORTANT: Do not expose an enable control until the complete recovery flow
 * (verified sender domain, delivery, single-use reset link and end-to-end tests)
 * is deployed and verified. This flag defaults to OFF in every environment.
 *
 * App Lock is a privacy screen, not a substitute for Firebase Authentication
 * or Firestore security rules.
 */
export const APP_LOCK_ENABLED = false as const;

export const APP_LOCK_PIN_LENGTH = 6;
export const APP_LOCK_INACTIVITY_MINUTES = [1, 2, 3] as const;
export const APP_LOCK_RESET_LINK_TTL_MINUTES = 10;

export type AppLockInactivityMinutes = typeof APP_LOCK_INACTIVITY_MINUTES[number];

export type AppLockSettings = {
  enabled: boolean;
  inactivityMinutes: AppLockInactivityMinutes;
};

/** Safe defaults for every account until the feature is explicitly launched. */
export const DEFAULT_APP_LOCK_SETTINGS: Readonly<AppLockSettings> = {
  enabled: false,
  inactivityMinutes: 1,
};

export function isValidAppLockPin(value: string): boolean {
  return /^\\d{6}$/.test(value);
}

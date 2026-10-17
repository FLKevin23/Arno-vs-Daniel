/**
 * Public configuration.
 *
 * None of this is secret. The Firebase web config is a project identifier that
 * every Firebase web app ships in its page source by design; access is decided
 * by Firestore rules, App Check and the Cloud Functions — not by hiding these
 * values. The bot TOKEN is a different thing entirely and lives only in Secret
 * Manager, server-side.
 */

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCKB1LcuXwIG0gLtEf__RBXZt-zuj2O6sg",
  authDomain: "arno-vs-daniel.firebaseapp.com",
  projectId: "arno-vs-daniel",
  appId: "1:195864793408:web:6553a937cb7504e0946aa5",
} as const;

/** Functions and Firestore both live here. */
export const FUNCTIONS_REGION = "europe-west1";

/**
 * The bot's username from @BotFather, WITHOUT the leading "@".
 * Until this is filled in, the page runs read-only and explains why.
 * The same bot must have its domain set to flkevin23.github.io
 * (BotFather -> /setdomain).
 */
export const TELEGRAM_BOT_USERNAME: string = "";

/**
 * reCAPTCHA v3 site key for App Check. Leave empty until handoff step 9 —
 * App Check goes last so a misconfiguration can't lock everyone out.
 */
export const APP_CHECK_SITE_KEY: string = "";

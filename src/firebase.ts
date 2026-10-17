import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { APP_CHECK_SITE_KEY, FIREBASE_CONFIG, FUNCTIONS_REGION } from "./config.js";

let app: FirebaseApp | undefined;

function getApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG);
    // App Check is opt-in until a site key exists (handoff step 9, last).
    if (APP_CHECK_SITE_KEY) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }
  return app;
}

export function auth(): Auth {
  return getAuth(getApp());
}

export function firestore(): Firestore {
  return getFirestore(getApp());
}

export function functions(): Functions {
  return getFunctions(getApp(), FUNCTIONS_REGION);
}

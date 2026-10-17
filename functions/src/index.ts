/**
 * Arno vs. Daniel — backend.
 *
 * Three callables, all in europe-west1 next to Firestore:
 *   tgAuth     verifies a Telegram Login Widget payload and mints a Firebase
 *              custom token whose uid is "tg:<telegram id>"
 *   castVote   writes the caller's vote, with the side derived server-side
 *              from the Telegram-verified name (never from client input)
 *   deleteVote removes the caller's own vote (right to erasure, S4)
 *
 * The signature checking lives in ./telegram.ts so it can be tested directly.
 * The bot token lives in Secret Manager and never touches the repo or client.
 */

import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import {
  deriveSide,
  maskHandle,
  TelegramVerificationError,
  verifyTelegramPayload,
  type Side,
  type TelegramPayload,
} from "./telegram.js";

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");

/**
 * App Check enforcement. Ship as `false`, confirm the rules and functions hold,
 * then flip to `true` and redeploy (handoff step 9 — last, to avoid locking
 * yourself out of your own site).
 */
const ENFORCE_APP_CHECK = false;

interface StoredIdentity {
  telegramId: string;
  firstName: string;
  lastName: string;
  username: string;
  side: Side | null;
  verifiedAt: FirebaseFirestore.FieldValue;
}

/**
 * Coarse per-IP throttle for the unauthenticated entry point (S10).
 * Fixed window, best-effort: this blunts scripted abuse, it is not a bulkhead.
 */
async function enforceRateLimit(ip: string, limit = 10, windowSeconds = 60): Promise<void> {
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const ref = db.collection("rateLimits").doc(key);
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;

  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const count = data && data["windowStart"] === windowStart ? Number(data["count"] ?? 0) : 0;
    if (count >= limit) return false;
    tx.set(ref, { windowStart, count: count + 1, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });

  if (!allowed) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Try again in a minute.");
  }
}

function requireTelegramUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid || !uid.startsWith("tg:")) {
    throw new HttpsError("unauthenticated", "Sign in with Telegram first.");
  }
  return uid;
}

/* ------------------------------------------------------------------ */
/* tgAuth                                                              */
/* ------------------------------------------------------------------ */

export const tgAuth = onCall(
  { secrets: [TELEGRAM_BOT_TOKEN], enforceAppCheck: ENFORCE_APP_CHECK, cors: true },
  async (request) => {
    const payload = request.data as TelegramPayload | undefined;
    if (!payload || typeof payload !== "object" || typeof payload.hash !== "string") {
      throw new HttpsError("invalid-argument", "Missing login payload.");
    }

    await enforceRateLimit(request.rawRequest.ip ?? "unknown");

    try {
      verifyTelegramPayload(payload, TELEGRAM_BOT_TOKEN.value());
    } catch (error) {
      if (error instanceof TelegramVerificationError) {
        logger.warn("telegram login rejected", { reason: error.reason });
        throw new HttpsError(
          error.reason === "expired" ? "deadline-exceeded" : "permission-denied",
          error.message,
        );
      }
      throw error;
    }

    const telegramId = String(payload.id);
    if (!/^\d{1,20}$/.test(telegramId)) {
      throw new HttpsError("invalid-argument", "Malformed Telegram id.");
    }

    const uid = `tg:${telegramId}`;
    const firstName = String(payload.first_name ?? "").slice(0, 40);
    const lastName = String(payload.last_name ?? "").slice(0, 40);
    const username = String(payload.username ?? "").slice(0, 32);
    const side = deriveSide(firstName, lastName, username);

    const identity: StoredIdentity = {
      telegramId,
      firstName,
      lastName,
      username,
      side,
      verifiedAt: FieldValue.serverTimestamp(),
    };
    await db.collection("identities").doc(uid).set(identity, { merge: true });

    const token = await getAuth().createCustomToken(uid, { tg: telegramId });
    logger.info("telegram login verified", { uid, side });

    return {
      token,
      side,
      handleMasked: maskHandle(username, firstName),
      displayName: firstName || username || "Someone",
    };
  },
);

/* ------------------------------------------------------------------ */
/* castVote                                                            */
/* ------------------------------------------------------------------ */

export const castVote = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, cors: true }, async (request) => {
  const uid = requireTelegramUid(request);

  const identitySnap = await db.collection("identities").doc(uid).get();
  const identity = identitySnap.data() as StoredIdentity | undefined;
  if (!identity) {
    throw new HttpsError("failed-precondition", "Sign in with Telegram again.");
  }

  // Re-derive rather than trusting the stored value, so tuning the token lists
  // takes effect without a migration.
  const side = deriveSide(identity.firstName, identity.lastName, identity.username);
  if (!side) {
    throw new HttpsError(
      "failed-precondition",
      "Your Telegram name doesn't identify you as an Arno or a Daniel, so you can watch but not vote.",
    );
  }

  const ref = db.collection("votes").doc(uid);
  const revision = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.data();
    const next = Number(prev?.["revision"] ?? 0) + 1;
    tx.set(
      ref,
      {
        side,
        handleMasked: maskHandle(identity.username, identity.firstName),
        createdAt: prev?.["createdAt"] ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        revision: next,
      },
      { merge: true },
    );
    return next;
  });

  logger.info("vote cast", { uid, side, revision });
  return { side, revision };
});

/* ------------------------------------------------------------------ */
/* deleteVote                                                          */
/* ------------------------------------------------------------------ */

export const deleteVote = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, cors: true }, async (request) => {
  const uid = requireTelegramUid(request);

  await db.collection("votes").doc(uid).delete();
  await db.collection("auditLog").add({
    uid,
    action: "delete",
    at: FieldValue.serverTimestamp(),
  });

  logger.info("vote deleted", { uid });
  return { deleted: true };
});

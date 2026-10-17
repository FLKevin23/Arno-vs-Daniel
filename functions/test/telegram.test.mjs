/**
 * Tests for the Telegram login verification and side derivation.
 * Plain node, no test framework:  npm run build && node test/telegram.test.mjs
 */

import assert from "node:assert/strict";
import {
  deriveSide,
  maskHandle,
  signPayload,
  verifyTelegramPayload,
  TelegramVerificationError,
} from "../lib/telegram.js";

const BOT_TOKEN = "123456:TEST-bot-token-not-a-real-secret";
const OTHER_TOKEN = "999999:some-other-bot";
const NOW = 1_700_000_000_000;
const FRESH = Math.floor(NOW / 1000) - 60;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

function signed(overrides = {}, token = BOT_TOKEN) {
  const payload = {
    id: 4242,
    first_name: "Arno",
    username: "arno_almagro",
    auth_date: FRESH,
    ...overrides,
  };
  return { ...payload, hash: signPayload(payload, token) };
}

function expectRejection(payload, reason) {
  try {
    verifyTelegramPayload(payload, BOT_TOKEN, NOW);
  } catch (error) {
    assert.ok(error instanceof TelegramVerificationError, `wrong error type: ${error}`);
    assert.equal(error.reason, reason);
    return;
  }
  throw new Error("expected rejection, but the payload was accepted");
}

console.log("\nsignature verification");

test("accepts a genuinely signed payload", () => {
  verifyTelegramPayload(signed(), BOT_TOKEN, NOW);
});

test("rejects a tampered id (the impersonation attempt)", () => {
  const payload = signed();
  payload.id = 9999;
  expectRejection(payload, "bad-hash");
});

test("rejects a tampered username", () => {
  const payload = signed();
  payload.username = "daniel_the_great";
  expectRejection(payload, "bad-hash");
});

test("rejects a payload signed with a different bot token", () => {
  expectRejection(signed({}, OTHER_TOKEN), "bad-hash");
});

test("rejects a forged hash", () => {
  expectRejection({ ...signed(), hash: "f".repeat(64) }, "bad-hash");
});

test("rejects an injected extra field", () => {
  expectRejection({ ...signed(), is_admin: true }, "unexpected-field");
});

test("rejects a login older than 24h (replay)", () => {
  const stale = Math.floor(NOW / 1000) - 86_401;
  expectRejection(signed({ auth_date: stale }), "expired");
});

test("accepts a login just inside the 24h window", () => {
  const edge = Math.floor(NOW / 1000) - 86_399;
  verifyTelegramPayload(signed({ auth_date: edge }), BOT_TOKEN, NOW);
});

test("rejects a login dated in the future", () => {
  const future = Math.floor(NOW / 1000) + 600;
  expectRejection(signed({ auth_date: future }), "expired");
});

test("rejects a non-numeric auth_date", () => {
  const payload = { id: 1, first_name: "Arno", auth_date: "soon" };
  expectRejection({ ...payload, hash: signPayload(payload, BOT_TOKEN) }, "malformed");
});

console.log("\nside derivation");

const sideCases = [
  ["Arno", "", "arno_almagro", "arno", "plain Arno"],
  ["Daniel", "Furrer", "danif", "daniel", "plain Daniel"],
  ["Dani", "Hofer", "danihofer", "daniel", "the nickname Dani"],
  ["Danny", "", "", "daniel", "the nickname Danny"],
  ["", "", "arno_al_paczino", "arno", "name only in the handle"],
  ["Arnold", "Schwarzenegger", "arnold_s", null, "Arnold is not an Arno"],
  ["Peter", "Muster", "petermuster", null, "someone in neither camp"],
  ["Arno", "Daniel", "arnodaniel", null, "ambiguous: both names"],
  ["ARNO", "", "", "arno", "upper case"],
  ["arno", "", "", "arno", "lower case"],
];

for (const [first, last, user, expected, label] of sideCases) {
  test(`${label} -> ${expected ?? "no side"}`, () => {
    assert.equal(deriveSide(first, last, user), expected);
  });
}

console.log("\nhandle masking");

test("masks a username", () => assert.equal(maskHandle("arno_almagro", "Arno"), "@arn***"));
test("falls back to the first name", () => assert.equal(maskHandle("", "Daniel"), "@dan***"));
test("handles a short handle", () => assert.equal(maskHandle("ab", "X"), "@ab***"));
test("handles no name at all", () => assert.equal(maskHandle("", ""), "@***"));
test("never leaks the full handle", () => {
  const masked = maskHandle("arno_almagro_the_third", "Arno");
  assert.ok(!masked.includes("almagro"), `leaked: ${masked}`);
  assert.ok(masked.length <= 7, `too long: ${masked}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

# Arno vs. Daniel — v2

Who has more namesakes in the group, the Arnos or the Daniels? One vote per
verified Telegram account, counted live.

Static frontend on GitHub Pages, Firebase for identity and data. No server to
run, no password anywhere.

---

## Why there is a v2

v1 was open to anyone with a loop: it used anonymous auth, and the database rules
allowed any signed-in user to write *any* record. Identity was never bound to the
row. 1147 votes arrived in a few minutes, 1004 of them for one side, timestamped
one millisecond apart.

The fix is not secrecy, it is authorisation:

| v1 | v2 |
|---|---|
| Anyone could mint an identity anonymously | Identity comes from Telegram, HMAC-verified server-side |
| Any user could write any record | Clients cannot write votes **at all** — only the backend can |
| Side and handle were typed into a form | Both derived from the verified Telegram name |
| Full names published | Only a masked handle (`@arn***`) is public |
| No way to remove your data | "Remove my vote" deletes the record |
| Untyped single file, no checks | TypeScript strict, lint, tests, CI |

---

## Architecture

```
GitHub Pages (static)                Firebase (europe-west1)
┌───────────────────────┐            ┌──────────────────────────────┐
│ index.html + TS/Vite  │ ─ callable │ tgAuth     verify + mint      │
│ Telegram Login Widget │ ─────────▶ │ castVote   derive side, write │
│ Firestore SDK (read)  │ ◀───────── │ deleteVote erase own record   │
└───────────────────────┘   snapshot │ Firestore rules (read-only)   │
                                     └──────────────────────────────┘
```

**The security model in one line:** no client can write a vote, so no client can
forge one. Votes are written only by `castVote`, which reads the caller's
Telegram-verified identity from `identities/` and derives the side itself.

### Data

```
votes/{uid}         public   side, handleMasked, createdAt, updatedAt, revision
identities/{uid}    private  telegramId, firstName, lastName, username, side
auditLog/{id}       private  deletions
rateLimits/{hash}   private  per-IP throttle for tgAuth
```

`uid` is always `tg:<telegram id>`, so one Telegram account is exactly one row —
that is what makes "one vote per handle" true rather than aspirational.

Nothing in `votes/` can identify a person beyond the first three characters of
their handle. The real identity never leaves the backend.

---

## Setup

> Step-by-step with checkpoints: **[SETUP.md](SETUP.md)**. The summary below
> is the same thing in brief.

### 1. Firebase

1. **Blaze plan.** Cloud Functions require it: Console → ⚙ → Usage and billing →
   Modify plan → Blaze. This workload sits inside the free allowance; set a
   budget alert at a few francs if you want a tripwire.
2. **Firestore.** Build → Firestore Database → Create → `europe-west1` →
   **production mode** (the rules in this repo replace the defaults).
3. **Authentication.** Build → Authentication → Get started. No provider needs
   enabling: sign-in happens with custom tokens minted by `tgAuth`.
   Turn **off** Anonymous if v1 left it on — nothing uses it now.
4. **Authorized domains.** Authentication → Settings → Authorized domains:
   keep only `flkevin23.github.io` and `localhost` (S9).

### 2. Telegram bot

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → follow the prompts.
2. `/setdomain` → pick the bot → send `flkevin23.github.io`.
   The login widget refuses to load on any other domain.
3. Put the bot's **username** (no `@`) in [`src/config.ts`](src/config.ts) as
   `TELEGRAM_BOT_USERNAME`.
4. Put the bot **token** in Secret Manager — never in the repo:

```bash
npx firebase login
npx firebase functions:secrets:set TELEGRAM_BOT_TOKEN
# paste the token when prompted
```

### 3. Deploy the backend

```bash
npm install
npm install --prefix functions
npm run deploy:backend     # Firestore rules + the three functions
```

### 4. Deploy the frontend

Settings → Pages → **Source: GitHub Actions** (not "Deploy from a branch").
Then every push to `main` builds and publishes automatically.

The site lands at `https://flkevin23.github.io/Arno-vs-Daniel/`.

### 5. App Check — last

Only after voting works end to end (handoff step 9, so a misconfiguration can't
lock everyone out):

1. Console → App Check → register the web app with reCAPTCHA v3.
2. Put the site key in `src/config.ts` as `APP_CHECK_SITE_KEY`.
3. Set `ENFORCE_APP_CHECK = true` in `functions/src/index.ts`, redeploy.
4. Enforce on Firestore in the console.

### 6. Clean up v1

The old Realtime Database still holds the 1147 junk votes and nothing reads it.
Console → Realtime Database → ⋮ → delete the instance, or clear the `votes` node.

---

## Who can vote

Your side is derived from your Telegram name, never chosen in a form:

- `Arno`, `@arno_almagro` → Arno
- `Daniel`, `Dani`, `Danny` → Daniel
- `Arnold` → nobody (whole-token match, so Arnold is not an Arno)
- `Peter` → nobody; signs in, sees the chart, cannot vote
- `Arno Daniel` → nobody; ambiguous by design, rather than letting them pick

The token lists live at the top of
[`functions/src/telegram.ts`](functions/src/telegram.ts). If the group has a
nickname this misses, add it there and redeploy — it is the only place the
mapping exists.

---

## Development

```bash
npm run dev                   # vite dev server
npm run check                 # typecheck + lint (innerHTML is a lint error, S7)
npm run build                 # production build into dist/
npm test --prefix functions   # 25 tests: signature forgery, replay, derivation
```

The test suite covers the attacks that matter: tampered id, tampered username,
wrong bot token, forged hash, injected fields, replayed and future-dated logins.
Run it before touching `telegram.ts`.

CI runs all of it on every push and refuses to deploy if anything fails.

---

## Notes on what is and isn't secret

`src/config.ts` holds the Firebase web config, and that is correct. It is a
project identifier, not a credential — every Firebase web app ships it in page
source, and it cannot be removed from a static site because the page needs it to
find the project. Access is decided by the Firestore rules, the functions and App
Check. The bot token is the real secret and lives only in Secret Manager.

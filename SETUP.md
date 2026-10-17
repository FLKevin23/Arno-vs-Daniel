# v2 setup runbook

Do the parts in order. Each one ends with a **Checkpoint** — if it doesn't match,
stop there rather than carrying the problem forward.

Total: about 25 minutes, most of it waiting for the first deploy.

---

## Part 1 — Blaze plan (5 min)

Cloud Functions do not exist on the free Spark plan. This is the only part that
needs a payment method.

1. Open <https://console.firebase.google.com> and select **arno-vs-daniel**.
2. Bottom of the left sidebar, click the plan badge that says **Spark** (or
   ⚙ **Project settings → Usage and billing → Details & settings**).
3. Click **Modify plan** → choose **Blaze — Pay as you go** → **Continue**.
4. Pick or create a **Cloud Billing account**: name it anything, enter card
   details, **Confirm purchase**.
5. Back in Firebase, it offers to **set a budget alert**. Set one:
   amount **CHF 5**, alerts at 50 / 90 / 100%. This is a tripwire, not a cap.

**What this actually costs:** this app is far inside the permanent free tier
(2M function calls and 50k Firestore reads per day). Expect CHF 0.00. The budget
alert exists so that if something ever loops, you hear about it the same day.

**Checkpoint:** the sidebar badge now reads **Blaze**.

---

## Part 2 — Firestore and Auth settings (4 min)

v2 uses Firestore, not the Realtime Database that v1 used.

1. Left menu → **Build → Firestore Database** → **Create database**.
2. Location: **eur3 (europe-west)** or **europe-west1**. This cannot be changed
   later, and it must be Europe to match the functions.
3. Mode: **Start in production mode** (locked). The rules in this repo replace
   the defaults in Part 5 — do not hand-edit rules in the console this time.
4. Click **Create** and wait for provisioning.

Then:

5. Left menu → **Build → Authentication** → **Get started**.
   Do **not** enable any sign-in provider. Sign-in happens with custom tokens
   minted by our own function.
6. If **Anonymous** is enabled from v1: **Sign-in method** → Anonymous →
   **Disable**. Nothing uses it now and it was half the problem.
7. **Authentication → Settings → Authorized domains**. Remove everything that
   isn't needed; keep only:
   - `flkevin23.github.io`
   - `localhost`

**Checkpoint:** Firestore shows an empty database in a European region, and
Authentication lists no enabled providers.

---

## Part 3 — BotFather (5 min)

1. In Telegram, open <https://t.me/BotFather> and press **Start**.
2. Send `/newbot`.
3. It asks for a **display name** — anything, e.g. `Arno vs Daniel`.
4. It asks for a **username** — must be unique and **end in `bot`**, e.g.
   `ArnoVsDanielVoteBot`. If taken, it says so; try another.
5. It replies with a line like:

   ```
   Use this token to access the HTTP API:
   8123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   **That token is the one real secret in this project.** Do not paste it into
   chat, the repo, or `config.ts`. It goes into Secret Manager in Part 4.
   If it ever leaks, send `/revoke` to BotFather and redo Part 4.

6. Bind the bot to your domain — without this the login button silently refuses
   to load:
   - Send `/setdomain`
   - Pick your bot from the list
   - Send exactly: `flkevin23.github.io`
   - It replies **Success! Domain updated.**

7. Put the bot's **username** (no `@`, exactly as you chose it) into
   [`src/config.ts`](src/config.ts):

   ```ts
   export const TELEGRAM_BOT_USERNAME: string = "ArnoVsDanielVoteBot";
   ```

**Checkpoint:** BotFather confirmed *Success! Domain updated.*, and
`src/config.ts` has your bot username.

---

## Part 4 — Secret and backend deploy (6 min)

In VS Code's terminal, from the project folder:

```bash
cd "C:\Users\Kevin\OneDrive\Tech Projects\arno-vs-daniel"
git checkout v2
```

1. Sign the CLI in (opens a browser — use the Google account that owns the
   Firebase project):

   ```bash
   npx firebase login
   ```

2. Store the bot token. This prompts for the value and never writes it to disk:

   ```bash
   npx firebase functions:secrets:set TELEGRAM_BOT_TOKEN
   ```

   Paste the token from Part 3 at the prompt and press Enter.

3. Install and deploy the backend:

   ```bash
   npm install
   npm install --prefix functions
   npm run deploy:backend
   ```

   First deploy takes a few minutes. Things it may say, all normal:
   - *"Enabling required APIs"* — let it (Cloud Functions, Build, Artifact Registry).
   - *"Set up a cleanup policy for Artifact Registry?"* — answer **yes**, pick
     the default (keeps old container images from accruing storage cost).

**Checkpoint:** the output ends with **Deploy complete!** and lists three
functions — `tgAuth`, `castVote`, `deleteVote` — in `europe-west1`. In the
console, **Firestore → Rules** now shows the rules from this repo, not the
default locked ones.

---

## Part 5 — GitHub Pages (3 min)

Order matters: switch the source **before** merging, or the first workflow run
fails with "Pages not enabled for this repository".

1. Go to <https://github.com/FLKevin23/Arno-vs-Daniel/settings/pages>
2. Under **Build and deployment → Source**, change the dropdown from
   **Deploy from a branch** to **GitHub Actions**. It saves on selection.
3. Commit your `config.ts` change and merge v2 into main:

   ```bash
   git add src/config.ts
   git commit -m "Set the Telegram bot username"
   git checkout main
   git merge v2
   git push origin main
   ```

4. Watch <https://github.com/FLKevin23/Arno-vs-Daniel/actions>. The run does
   typecheck → lint → backend tests → build → deploy. It refuses to publish if
   any step fails, which is the point.

**Checkpoint:** the workflow run is green and
<https://flkevin23.github.io/Arno-vs-Daniel/> loads with the Telegram button
visible.

---

## Part 6 — Verify it actually works (3 min)

1. Open the site. The tally loads without signing in — that is correct, viewing
   is public.
2. Click **Log in with Telegram** and authorise.
3. What you should see depends on your own Telegram name:
   - named Arno or Daniel → *"recognised as …"* and a **Count me as …** button
   - anything else → *"you can watch but not vote"*, no vote button
4. Vote. The donut and the roll update live, and your row shows a **you** badge.
5. Click **Remove my vote** — it disappears from the tally.

Then try to break it, since that's the whole point of v2: open the site in a
private window, sign in as yourself again, and confirm you still hold exactly
one row. There is no form to type a name into, and no client write path at all.

**If voting fails**, check in this order:
- Browser console for a CSP or CORS error
- `npx firebase functions:log` — shows rejected logins and the reason
- That the BotFather domain is exactly `flkevin23.github.io`

---

## Part 7 — App Check (later, not now)

Deliberately last. Enforcing it before the rest is proven locks you out of your
own site, which is why it is step 9 in the handoff.

Do this only once Part 6 fully passes:

1. Console → **App Check** → **Apps** → register the web app → **reCAPTCHA v3**.
2. Copy the **site key** into `src/config.ts` as `APP_CHECK_SITE_KEY`.
3. In `functions/src/index.ts` set `ENFORCE_APP_CHECK = true`.
4. `npm run functions:deploy`, then push to main so the frontend rebuilds.
5. Only after the site still works: console → App Check → **Enforce** on
   Firestore and on Cloud Functions.

---

## Part 8 — Retire v1

Once v2 is live, the old Realtime Database still holds the 1147 junk votes and
nothing reads it.

Console → **Realtime Database** → ⋮ (next to the URL) → **Delete database**,
or just clear the `votes` node.

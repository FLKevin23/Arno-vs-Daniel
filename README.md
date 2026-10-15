# Arno vs. Daniel

A small voting page for the Telegram group: who has more namesakes, the Arnos or
the Daniels? Each person enters their name and Telegram handle and picks their
side. The page shows a live donut chart and the public list of everyone who voted.

One `index.html` — no build step, no dependencies, runs straight on GitHub Pages.

---

## 1. Set up Firebase (about 3 minutes)

Without this the page runs in **demo mode**: votes stay in your own browser and
nobody else sees them. A gold banner at the top of the page says so.

1. Open [console.firebase.google.com](https://console.firebase.google.com) →
   **Add project** → name it something like `arno-vs-daniel` → you can switch off
   Google Analytics.
2. In the left menu: **Build → Realtime Database** → **Create database** → pick a
   region (`europe-west1`) → **Start in test mode**.
3. The database URL is now shown at the top, something like
   `https://arno-vs-daniel-default-rtdb.europe-west1.firebasedatabase.app`.
4. Go to **Project settings** (gear icon) → under "Your apps" click the
   **web icon `</>`** → register the app → you get a `firebaseConfig` object.
5. Copy those values into the `FIREBASE_CONFIG` block near the top of the script
   in [`index.html`](index.html) (`apiKey`, `authDomain`, `databaseURL`,
   `projectId`, `appId`).

> These keys belong in the source and are not secrets — access is controlled by
> the database rules, not by the key.

### Database rules

Test mode expires after 30 days. Replace the rules under
**Realtime Database → Rules** with:

```json
{
  "rules": {
    "votes": {
      ".read": true,
      "$handle": {
        ".write": true,
        ".validate": "newData.hasChildren(['name','handle','side','ts']) && newData.child('side').val().matches(/^(arno|daniel)$/) && newData.child('name').isString() && newData.child('name').val().length <= 40 && newData.child('handle').isString() && newData.child('handle').val().length <= 41"
      }
    }
  }
}
```

That lets anyone read the votes and write a valid one, but keeps arbitrary data
out of the database.

---

## 2. Publish on GitHub Pages

```bash
git remote add origin https://github.com/<your-user>/arno-vs-daniel.git
git branch -M main
git push -u origin main
```

Then in the repository: **Settings → Pages → Source: Deploy from a branch →
Branch `main`, folder `/ (root)` → Save.**

A minute or two later the page is live at
`https://<your-user>.github.io/arno-vs-daniel/` — that's the link for the group.

---

## How the vote works

- **One vote per Telegram handle.** The handle is the key, so voting again
  updates your own vote instead of adding a second one.
- **The list is public.** Every vote appears with its name and handle at the
  bottom of the page. That's the real safeguard — in a group of friends, a name
  that doesn't belong gets spotted immediately.
- **Soft name check.** If the name doesn't match the chosen side (say "Peter"
  picks "I'm an Arno"), a note appears. It isn't blocked, so nicknames like
  "Dani" still work.
- **No login.** Without sign-in, anyone could technically enter someone else's
  handle. For a group of friends the public list is enough; making it airtight
  would mean a Telegram login.

## Data model

```
votes/
  arnom:  { name: "Arno Meier",   handle: "@arnom", side: "arno",   ts: 1760… }
  danif:  { name: "Daniel Furrer", handle: "@danif", side: "daniel", ts: 1760… }
```

The key is the lower-cased handle without `@` and without special characters.

## Colours

The two chart colours aren't a style choice, they're checked for legibility: gold
`#b88a1e` and steel blue `#3f7fb8` stay far apart under every red-green colour
vision deficiency (ΔE 22 against a target of 8) and both clear 3:1 contrast on the
black background. Gold and silver would have matched the theme more closely but
would have been indistinguishable for colourblind readers.

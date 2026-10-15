# Arno vs. Daniel

Eine kleine Abstimmungsseite für die Telegram-Gruppe: Wer hat mehr Namensvettern,
die Arnos oder die Daniels? Jede Person trägt Namen und Telegram-Handle ein und
wählt ihre Seite. Die Seite zeigt live einen Donut und die öffentliche Liste aller
Stimmen.

Eine einzelne `index.html` — kein Build, keine Abhängigkeiten, läuft direkt auf
GitHub Pages.

---

## 1. Firebase einrichten (ca. 3 Minuten)

Ohne diesen Schritt läuft die Seite im **Demo-Modus**: Stimmen bleiben nur im
eigenen Browser und niemand sonst sieht sie. Ein gelber Hinweis oben auf der Seite
sagt das auch.

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen →
   **Projekt hinzufügen** → Name z. B. `arno-vs-daniel` → Google Analytics kannst
   du abwählen.
2. Links im Menü **Build → Realtime Database** → **Datenbank erstellen** →
   Region wählen (`europe-west1`) → **Im Testmodus starten**.
3. Oben steht jetzt die Datenbank-URL, etwa
   `https://arno-vs-daniel-default-rtdb.europe-west1.firebasedatabase.app`.
4. **Projektübersicht** (Zahnrad → Projekteinstellungen) → unten bei „Meine Apps"
   auf das **Web-Symbol `</>`** → App registrieren → du bekommst ein
   `firebaseConfig`-Objekt.
5. Diese Werte in [`index.html`](index.html) oben im Block `FIREBASE_CONFIG`
   eintragen (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`).

> Diese Keys gehören in den Quelltext und sind nicht geheim — der Zugriff wird
> über die Datenbank-Regeln gesteuert, nicht über den Key.

### Datenbank-Regeln

Der Testmodus läuft nach 30 Tagen ab. Ersetze die Regeln unter
**Realtime Database → Regeln** durch:

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

Das erlaubt allen das Lesen und das Schreiben einer gültigen Stimme, aber keine
beliebigen Daten in der Datenbank.

---

## 2. Auf GitHub Pages veröffentlichen

```bash
git remote add origin https://github.com/<dein-user>/arno-vs-daniel.git
git branch -M main
git push -u origin main
```

Dann im Repository: **Settings → Pages → Source: Deploy from a branch →
Branch `main`, Ordner `/ (root)` → Save.**

Nach ein, zwei Minuten liegt die Seite auf
`https://<dein-user>.github.io/arno-vs-daniel/` — dieser Link kommt in die Gruppe.

---

## Wie die Abstimmung funktioniert

- **Eine Stimme pro Telegram-Handle.** Das Handle ist der Schlüssel: Wer nochmal
  abstimmt, ändert seine eigene Stimme, statt eine zweite abzugeben.
- **Die Liste ist öffentlich.** Jede Stimme steht mit Namen und Handle unten auf
  der Seite. Das ist die eigentliche Kontrolle — in einer Freundesgruppe sieht
  jeder sofort, wenn ein Name nicht stimmt.
- **Sanfte Prüfung.** Wenn der eingetragene Name nicht zur gewählten Seite passt
  (z. B. „Peter" wählt „Ich bin ein Arno"), erscheint ein Hinweis. Blockiert wird
  es nicht, damit Spitznamen wie „Dani" weiter funktionieren.
- **Kein Login.** Ohne Anmeldung kann technisch jeder ein beliebiges Handle
  eintragen. Für eine Freundesgruppe ist die öffentliche Liste genug; wer es
  wasserdicht will, braucht einen Telegram-Login.

## Datenmodell

```
votes/
  arnom:      { name: "Arno Meier", handle: "@arnom", side: "arno",   ts: 1760… }
  danif:      { name: "Daniel Furrer", handle: "@danif", side: "daniel", ts: 1760… }
```

Der Schlüssel ist das kleingeschriebene Handle ohne `@` und ohne Sonderzeichen.

## Farben

Die beiden Chart-Farben sind nicht frei gewählt, sondern auf Lesbarkeit geprüft:
Gold `#b88a1e` und Stahlblau `#3f7fb8` liegen bei allen Rot-Grün-Sehschwächen
weit auseinander (ΔE 22 gegenüber einem Richtwert von 8) und haben über 3:1
Kontrast zum schwarzen Hintergrund. Gold und Silber wären stilistisch näher
gewesen, hätten sich aber für farbfehlsichtige Leser nicht unterschieden.

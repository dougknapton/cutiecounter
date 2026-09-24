# Tasks

A small installable web app (PWA) that looks like an ordinary task list. Each "task" is a
compliment, and submitting one appends a row to a Google Sheet through a Google Apps Script
web app. It runs without a server or OAuth, and it keeps working offline.

```
index.html                 App shell (title "Tasks", manifest, icons; no external resources)
vite.config.ts             Build config + plugin that generates the service worker precache list
sw-template.js             Service worker (cache-first app shell); built to dist/sw.js
public/                    manifest.webmanifest, checkmark icons (SVG + PNG)
scripts/make-icons.mjs     Regenerates the PNG icons (npm run icons)
src/labels.ts              ALL user-facing text + option lists + seed compliments
src/config.ts              Env vars, coordinate rounding, timeouts
src/api.ts                 Apps Script calls (text/plain POST, GET list)
src/queue.ts               Persistent outbox with automatic retry
src/compliments.ts         Cached compliment list + usage counts
src/geo.ts, src/time.ts    Location and local ISO 8601 timestamp
src/App.tsx, src/screens/  The two screens
apps-script/Code.gs        Backend: doGet / doPost / setup()
```

---

## Setup

### 1. Create the Google Sheet

1. Create a new blank spreadsheet at <https://sheets.new> and give it any name.
2. You don't need to create the tabs yourself. `setup()` in step 2 creates them:
   - **Log**: `Timestamp | Latitude | Longitude | Compliment | Gender | Race | Age Range | Entry ID`
   - **Compliments**: a header in A1 and one compliment per row from A2, seeded with the
     five defaults.
   - **Log › Compliment** (column D) gets a dropdown sourced from `Compliments!A2:A`.

### 2. Add and deploy the Apps Script

1. In the Sheet, open **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs), then save.
3. Create the shared secret. Run `openssl rand -hex 24`, or type any long random string.
4. Open **Project Settings** (the gear icon) → **Script Properties** → **Add script property**.
   Set the name to `SHARED_TOKEN` and the value to your secret, then save.
5. Go back to the editor, select `setup` in the function dropdown, and click **Run**. Approve
   the authorization prompt. The tabs, headers and validation are created. Running it again
   is safe.
6. Click **Deploy → New deployment**, then the gear → **Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone. This is required because the app calls it without a
     Google login. The token protects it.
7. Click **Deploy** and copy the **Web app URL**, which ends in `/exec`.

Check that it works:

```sh
curl -L "https://script.google.com/macros/s/XXXX/exec?action=list&token=YOUR_TOKEN"
# {"compliments":[{"name":"So Cute","count":0}, ...],"ok":true}
```

> **When you change Code.gs later:** go to **Deploy → Manage deployments → ✏️ Edit →
> Version: New version → Deploy**. Doing it this way keeps the same URL. A *new*
> deployment gets a new URL.

### 3. Set environment variables

```sh
cp .env.example .env
# edit .env:
#   VITE_APPS_SCRIPT_URL=<the /exec URL>
#   VITE_APPS_SCRIPT_TOKEN=<same value as SHARED_TOKEN>
npm install
npm run dev        # http://localhost:5173 (the service worker only runs in production builds)
```

The values are baked in at build time, so rebuild after you change them.

### 4. Deploy the frontend

The app must be served over **HTTPS**, because location access and the service worker need
it. Both options below provide HTTPS.

**Netlify**

1. Push this repo to GitHub, then in Netlify choose **Add new site → Import from Git**.
   `netlify.toml` already sets the build command (`npm run build`) and publish directory
   (`dist`).
2. Under **Site configuration → Environment variables**, add `VITE_APPS_SCRIPT_URL` and
   `VITE_APPS_SCRIPT_TOKEN`, then trigger a deploy.
3. Optional: rename the site to something bland, such as `tasks-4821.netlify.app`.

**GitHub Pages**

1. In the repo, go to **Settings → Secrets and variables → Actions** and add
   `VITE_APPS_SCRIPT_URL` and `VITE_APPS_SCRIPT_TOKEN` as repository secrets.
2. Under **Settings → Pages → Source**, choose **GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand. The site is
   published at `https://<user>.github.io/<repo>/`. The build uses relative paths, so the
   subfolder works.

### 5. Install on your phone

**iPhone (Safari)**

1. Open the site in **Safari**. Other iOS browsers can't install web apps to the Home Screen.
2. Tap **Share → Add to Home Screen**. The name is already "Tasks". Tap **Add**.
3. Open it from the Home Screen icon and allow location when asked.
4. If you never see a location prompt, turn on **Settings → Privacy & Security → Location
   Services → Safari Websites → While Using the App**.

**Android (Chrome)**

1. Open the site in Chrome.
2. Tap **⋮ → Install app** (or **Add to Home screen**), then **Install**.
3. Open it from the launcher and allow location.

Open the app once while you're online after installing. That caches the app and the
compliment list, so it works offline from then on.

---

## Customizing

- **Labels and options:** edit `src/labels.ts`. The option strings are exactly what's written
  to the Sheet. The gender options are placeholders.
- **Location precision:** in `src/config.ts`, `roundCoordinates` / `coordinateDecimals`
  (3 decimals ≈ 110 m). Set `roundCoordinates: false` to send full precision.
- **Compliments:** you can add, fix or remove rows in the **Compliments** tab directly. The
  app picks up the changes the next time it loads the list while online.
- **Icon:** edit `public/icon.svg` and `scripts/make-icons.mjs` (keep them matching), then
  run `npm run icons`.

---

## How reliability works

- **Submit** saves the entry to the local queue *first* (in `localStorage`), shows
  "Task saved", and then tries to send it.
- An entry leaves the queue only when Apps Script replies `{"ok": true}`.
- Retries run on app launch, when the device comes back online, when the app returns to the
  foreground, and every 60 s while anything is pending. When entries are waiting, a small
  grey "N pending" appears next to the title.
- Each entry has a unique ID (the **Entry ID** column). If a request succeeds but the reply is
  lost, the retry is recognised and not appended twice.
- New compliments go through the same queue. You can use a compliment you just added right
  away, even offline.
- The compliment list and counts are cached locally. Counts include entries still waiting in
  the queue.

---

## Notes: assumptions and omissions

- **Extra column.** Column H, **Entry ID**, is added to the Log tab so retries don't create
  duplicate rows. You can hide it.
- **The token is not strong security.** Anything built into a static site can be read by
  someone who loads the site and inspects the JavaScript. The token stops random requests to
  the Apps Script URL. It does not protect against someone who has your site URL. Keep the URL
  private. The page sets `noindex` and `no-referrer`. If the token leaks, change
  `SHARED_TOKEN`, update the env var and redeploy. Queued entries that fail with the old token
  stay in the queue until a build with the new token sends them.
- **Disguise and the URL.** In standalone (home-screen) mode no URL bar is shown. The site
  address can still give things away, for example a GitHub Pages URL that contains the repo
  name `cutiecounter`. Use a bland Netlify site name, or a neutral repo name for Pages.
- **Submitting with details missing** is allowed. Unselected fields are left blank, and
  tapping a selected option again clears it. Only the compliment is required.
- **Validation mode.** The Compliment dropdown is set to *warn* on invalid values instead of
  *reject*, so validation can never block an entry from saving. The script also writes the
  compliment with the Compliments tab's exact spelling. Change `setAllowInvalid(true)` to
  `false` in `setup()` if you want strict validation.
- **Timestamp** is stored as plain text, exactly as sent (e.g. `2026-09-24T14:03:11-07:00`), so
  Sheets doesn't convert it to its own timezone.
- **Location** is requested on first launch. On Submit the app waits up to 4 s for a fix. A fix
  from the last 2 minutes is reused, and a fresh fix starts when you tap Next. If there's no
  fix, the entry is saved with blank coordinates.
- **Storage:** the queue uses `localStorage`, and the app asks the browser for persistent
  storage. iOS can clear storage for sites that aren't installed after about 7 days without
  use. Installed home-screen apps are exempt, so install it.
- **No Background Sync.** iOS doesn't support it, so queued entries are sent the next time the
  app is open and online, not while it's closed.
- **Rejected entries.** If the server rejects an item (for example a wrong token), the item
  stays queued and counted as pending instead of being dropped. It doesn't hold up the items
  behind it.
- **App updates.** A new deploy is downloaded in the background and takes effect the next time
  the app is launched.
- **Not included:** viewing, editing or deleting past entries in the app (use the Sheet);
  multiple people per entry; automated tests. The flows were checked in headless Chromium
  against a mocked Apps Script endpoint: sorting, back navigation, text/plain POST with token,
  coordinate rounding, the offline queue, reload while offline, and in-order flush on
  reconnect.

# Stride

A running and cycling tracker: record activities on your iPhone, see them on the web.

```
apps/mobile      iPhone app (React Native + Expo)
apps/web         Website (Next.js)
apps/api         Backend server (Node.js + Fastify + PostgreSQL)
packages/shared  Code all three use: data shapes, validation, distance/pace maths
```

## First-time setup

1. **Install packages** (from this folder):
   ```bash
   npm install
   ```

2. **Get a free database.** Sign up at https://neon.tech, create a project, and copy its connection string.

3. **Configure the API.** Copy `apps/api/.env.example` to `apps/api/.env`, then paste in the
   connection string and a random `JWT_SECRET`.

4. **Create the database tables:**
   ```bash
   npm run db:migrate
   ```

## Running it (three terminals)

```bash
npm run dev:api      # API on http://localhost:4000
npm run dev:web      # Website on http://localhost:3000
npm run dev:mobile   # Shows a QR code for the iPhone app
```

**On your iPhone:** install **Expo Go** from the App Store, make sure the phone is on the same
Wi-Fi as your computer, then scan the QR code with the Camera app.

If the app says it can't reach the server, check the "Server" address at the bottom of the
**You** tab, and allow Node.js through Windows Firewall on private networks.

## Good to know

- In Expo Go, GPS only records while the app is open, so the Record screen keeps your screen on.
  Background tracking needs a "development build" (`eas build --profile development`), which
  we'll set up in a later phase.
- The server works out distance, time and elevation itself from the GPS points, so the numbers
  are the same everywhere.
- After pulling new code, run `npm run db:migrate` again. It adds any new tables or columns and
  fills in data for activities you recorded before (e.g. personal records).

## Activity types

Each type has its own features. What each one measures lives in `packages/shared/src/categories.ts`.

| | Live on the Record screen | Voice update | On the activity screen |
|---|---|---|---|
| **Run** | Time, distance, avg pace, current split pace | every 1 km | Splits, best efforts (400m to marathon), cadence |
| **Ride** | Live speed, max speed, avg speed | every 5 km | 5 km splits, best efforts (5K to 100K), max speed |
| **Walk** | Time, distance, steps | every 1 km | Steps, splits, best efforts (1K to 10K) |
| **Hike** | Time, distance, climb, altitude | every 1 km | Elevation profile first, highest point |

Every saved activity is compared with your earlier ones of the same type to award achievements:
first activity, PRs (plus 2nd and 3rd fastest), longest, biggest climb and most steps.

## The app's tabs

- **Home:** swipeable streak and this-week cards, your activity feed (with share), and suggested
  challenges. **+** adds an activity by hand (treadmill, bike computer); the bell lists your achievements.
- **Maps:** every route you've recorded on one map, colored by sport. Tap a route to open it.
- **Record:** full-screen map, GPS status, a stats panel that expands to big numbers and splits,
  a sport picker and voice updates.
- **Groups:** monthly challenges (e.g. "October 50K Run", "400-Minute Challenge"). Join one and your
  activities count automatically; finished ones go in your trophy case.
- **You:** Progress (this week, past 12 weeks chart, streak calendar, weekly goal, best efforts),
  Activities, and More (statistics, trophy case, settings).

## Friends

- **Find people:** search by name, "Who to Follow" suggestions (people who follow you, friends
  of friends, active athletes), your QR code and a scanner, and invites by text or share sheet.
- **Follow** people to see their activities in your Home feed. Give **kudos**, **comment**, and
  open their profile (followers, following, activities).
- **Messages:** private one-to-one chats with anyone you follow or who follows you.
- **Notifications:** new followers, kudos and comments, plus your achievements.
- **Clubs** (Groups tab): create or join a club for a sport, with a weekly distance leaderboard.
- **Who can view** each activity: Everyone, Followers, or Only You. Private activities never
  appear in feeds, clubs or shared heatmaps.

To try Friends you need a second account: register one on the website or another phone.

## Live in the cloud (no laptop needed)

| Part | Where it runs |
|---|---|
| Database | Neon (Singapore) |
| Backend API | Render, `https://stride-api-sa5e.onrender.com` (free plan, Singapore). Redeploys on every push to `main` and runs new migrations automatically. Config: [`render.yaml`](render.yaml) |
| iPhone app | Expo's cloud (EAS Update, channel `production`), opened in Expo Go |

**Open the app anywhere** (Wi-Fi or mobile data, laptop off): in Expo Go, signed in as the
project owner, open
`exp://u.expo.dev/4e419f43-5433-41ca-be3d-8ac8867a9622?runtime-version=exposdk%3A57.0.0&channel-name=production`.
Expo Go then keeps Stride in its recently opened list.

**Publish app changes** (after committing them), to iPhone (Expo Go) and Android:
```bash
npm run publish:app
```

**Android app** (a real app with the Stride icon, installed from a link, not the Play Store):
```bash
npm run build:android
```
Builds an APK on Expo's free build service (profile `android-apk` in `apps/mobile/eas.json`).
The finished build has a download link and QR code on expo.dev. Only rebuild when native
code changes (new native packages, app.json permissions or icons); everything else reaches
installed apps through `npm run publish:app`.

- Maps on Android use MapLibre with free OpenFreeMap tiles (no account or key). iPhone uses
  Apple Maps. Each map is a component with an `.android.tsx` twin (`route-map`,
  `maps-tab-map`, `create-route-map`); keep both in step.
- Android has no `Alert.prompt`; use `promptText()` from `components/text-prompt.tsx`.
- Google plans to require developer verification for apps installed outside the Play Store;
  it starts outside India first (expected in India in 2027).

## Safety and privacy

- **Privacy zone:** other people never see the first and last 200 m of a route (maps, feed,
  clubs, activity detail, shared heatmap). See `hideEnds` in `packages/shared/src/geo.ts`.
- **Block and report:** ⋯ on a profile or chat. Blocks apply in both directions everywhere
  (see `noBlockBetween` in `apps/api/src/activity-sql.ts`). Reports go to the `reports`
  table; review them in the Neon console (`SELECT * FROM reports WHERE status = 'open'`).
- **Delete account:** You → Settings → Delete Account (asks for the password). Erases the
  account and everything linked to it.
- **Rate limits** on login, sign-up and account deletion.
- **Privacy policy and terms:** served by the API at `/privacy` and `/terms`. To show a
  contact address in them, set `CONTACT_EMAIL` on Render (use a dedicated address, not a
  personal one). Update these pages whenever the app starts collecting something new.
The published app gets the API address from the `EXPO_PUBLIC_API_URL` variable in the EAS
`production` environment (not from `.env.production`, which only local `expo export` uses).

Good to know:
- Render's free plan sleeps after 15 minutes without use, so the first request after a break
  can take up to a minute.
- `ios.runtimeVersion` is `exposdk:57.0.0` so Expo Go can load the update. When Expo Go moves to a
  new SDK, upgrade the project (`npx expo install expo@latest --fix`) and update this value.
  For a TestFlight/App Store build, switch it to `{ "policy": "appVersion" }`.

## Running on your phone quickly

`npm run dev:mobile` runs in development mode (live reload, slower). For a quick, smooth
preview, run the app in production mode instead:

```bash
cd apps/mobile && npx expo start --no-dev --minify
```

In Expo Go, the first screen (app icon and name) is Expo Go's own loading screen and can't be
changed. A real build (`eas build`) shows Stride's STRIDE splash from the very first frame.

To check layouts in a desktop browser, run `npx expo start --web` in `apps/mobile`. Maps show a
grey placeholder there (Apple Maps only exists on the phone); everything else works.

## Roadmap

- [x] **Phase 1:** accounts, GPS recording, activity list and maps (mobile + web)
- [x] **Phase 1.5:** per-type features, achievements, weekly streak, personal records
- [x] **Phase 1.6:** Strava-style tabs (Home, Maps, Record, Groups, You), challenges, goals, manual activities
- [x] **Phase 1.7:** Maps (route suggestions, heatmaps, map types, create and saved routes)
- [x] **Phase 2:** follow people, search, kudos, comments, messages, notifications, clubs
- [ ] **Phase 3:** push notifications, photos, segments and leaderboards, club events
- [ ] **Phase 3:** charts over time, goals
- [ ] **Phase 4:** segments and leaderboards (PostGIS), challenges, clubs

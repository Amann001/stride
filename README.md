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

## Running on your phone quickly

`npm run dev:mobile` runs in development mode (live reload, slower). For a quick, smooth
preview, run the app in production mode instead:

```bash
cd apps/mobile && npx expo start --no-dev --minify
```

In Expo Go, the first screen (app icon and name) is Expo Go's own loading screen and can't be
changed. A real build (`eas build`) shows Stride's STRIDE splash from the very first frame.

## Roadmap

- [x] **Phase 1:** accounts, GPS recording, activity list and maps (mobile + web)
- [x] **Phase 1.5:** per-type features, achievements, weekly streak, personal records
- [x] **Phase 1.6:** Strava-style tabs (Home, Maps, Record, Groups, You), challenges, goals, manual activities
- [x] **Phase 1.7:** Maps (route suggestions, heatmaps, map types, create and saved routes)
- [x] **Phase 2:** follow people, search, kudos, comments, messages, notifications, clubs
- [ ] **Phase 3:** push notifications, photos, segments and leaderboards, club events
- [ ] **Phase 3:** charts over time, goals
- [ ] **Phase 4:** segments and leaderboards (PostGIS), challenges, clubs

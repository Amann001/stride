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

## Roadmap

- [x] **Phase 1:** accounts, GPS recording, activity list and maps (mobile + web)
- [ ] **Phase 2:** follow people, feed, kudos, comments
- [ ] **Phase 3:** profile stats, personal records, charts
- [ ] **Phase 4:** segments and leaderboards (PostGIS), challenges, clubs

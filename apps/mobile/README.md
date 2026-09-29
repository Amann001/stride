# Mobile app (iPhone)

React Native + Expo. Run it from the project root with `npm run dev:mobile`, then scan the QR code
with your iPhone camera (Expo Go must be installed). See the root README for full setup.

- `src/app/` holds the screens. Every file there is a screen, and `_layout.tsx` files set up navigation.
- `src/lib/` holds the API client, login state and the GPS recorder.
- `src/components/` holds reusable pieces (map, stat blocks, activity cards).

Always add native packages with `npx expo install <package>`, so the versions match the Expo SDK.

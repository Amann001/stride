import type { FastifyInstance } from 'fastify';

// The privacy policy and terms of use, served as simple web pages so the app (and anyone
// thinking of joining) can read them at /privacy and /terms. Keep them in step with what
// the app really does: if a feature starts collecting something new, update this first.

const UPDATED = '2 October 2026';

// Optional contact address for privacy requests (set CONTACT_EMAIL on the server).
// Left out of the code on purpose, so no personal address ends up in the repository.
const contactLine = () =>
  process.env.CONTACT_EMAIL
    ? `<p>Questions or requests: <a href="mailto:${process.env.CONTACT_EMAIL}">${process.env.CONTACT_EMAIL}</a>.</p>`
    : '<p>Questions or requests: use <b>Report</b> on any profile in the app, or delete your account from <b>Settings</b>.</p>';

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Stride</title>
<style>
:root{color-scheme:light dark;--fg:#121212;--muted:#6e6e73;--bg:#fff;--accent:#4d6b00}
@media (prefers-color-scheme:dark){:root{--fg:#f4f4f5;--muted:#a1a1aa;--bg:#121212;--accent:#c8f31d}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 64px}h1{font-size:28px;margin:8px 0 4px}
h2{font-size:19px;margin:28px 0 6px}p,li{color:var(--fg)}small,.muted{color:var(--muted)}a{color:var(--accent)}
ul{padding-left:20px}
</style></head><body><main>${body}</main></body></html>`;
}

const privacy = () =>
  page(
    'Privacy Policy',
    `<h1>Privacy Policy</h1><p class="muted">Last updated ${UPDATED}</p>
<p>Stride is a free app for recording runs, rides, walks and hikes. This page explains what we collect, why, who can see it, and how to delete it. We don't sell your data, show ads, or use advertising or analytics trackers.</p>

<h2>What we collect</h2>
<ul>
<li><b>Account:</b> your name, email address and password. The password is stored only as a secure hash, never as plain text. Optionally, a bio and a location you type in.</li>
<li><b>Activities:</b> the GPS track of each activity you record (positions, times, altitude), plus distance, time, pace, elevation and, for runs, walks and hikes, a step count from your phone's motion sensor.</li>
<li><b>Social:</b> who you follow, kudos, comments, private messages, clubs you create or join, routes you save, challenges you join, and reports you send.</li>
</ul>

<h2>Permissions on your phone</h2>
<ul>
<li><b>Location:</b> only while you're using the app: to record an activity, and to show the map and routes near you. Stride does not track you when you're not using it.</li>
<li><b>Motion:</b> to count steps during an activity.</li>
<li><b>Camera:</b> only to scan a friend's Stride QR code. Nothing is recorded or uploaded.</li>
<li><b>Contacts:</b> only when you choose a friend to invite. Your contacts stay on your phone and are never uploaded.</li>
</ul>

<h2>Who can see your activities</h2>
<ul>
<li>You choose for each activity: <b>Everyone</b>, <b>Followers</b>, or <b>Only You</b>.</li>
<li><b>Privacy zone:</b> other people never see the first and last 200 m of your routes, so the place you start from (often your home) stays hidden. This includes the shared heatmap.</li>
<li>Only activities set to Everyone appear in the shared heatmap, and only as anonymous lines.</li>
<li>Your email address is never shown to other people.</li>
<li>Private messages can only be read by you and the person you're talking to in the app. They are stored on our servers (not end-to-end encrypted), so don't share passwords or other secrets in them.</li>
<li>If you <b>block</b> someone, neither of you can see, follow, message or comment on the other.</li>
</ul>

<h2>Services we use</h2>
<ul>
<li><b>Render</b> (servers) and <b>Neon</b> (database) store and process your data, in Singapore.</li>
<li><b>Expo</b> delivers the app and its updates to your phone.</li>
<li><b>Apple Maps</b> (iPhone) or <b>Google Maps</b> (Android) show the maps; they receive the map area you're looking at.</li>
<li>For suggested and planned routes, the points of the route are sent to <b>OpenStreetMap routing (FOSSGIS)</b> and <b>Open-Meteo</b> (elevation). Route data © OpenStreetMap contributors.</li>
</ul>

<h2>How long we keep it</h2>
<p>Until you delete it. Deleting an activity removes it straight away. <b>Deleting your account</b> (Settings → Delete account) permanently erases your account and everything linked to it: activities, routes, follows, kudos, comments, messages and clubs you created. Short-term database backups kept by our provider are overwritten within a few days.</p>

<h2>Your rights</h2>
<p>You can see and edit your profile and activities in the app, change who can see each activity, and delete your account at any time. You can ask us about your data using the contact below.</p>

<h2>Age</h2>
<p>You must be 18 or older to create a Stride account.</p>

<h2>Changes</h2>
<p>If this policy changes, we'll update the date at the top. Significant changes will be announced in the app.</p>
${contactLine()}`,
  );

const terms = () =>
  page(
    'Terms of Use',
    `<h1>Terms of Use</h1><p class="muted">Last updated ${UPDATED}</p>
<p>By creating a Stride account you agree to these terms and to the <a href="/privacy">Privacy Policy</a>.</p>

<h2>Who can use Stride</h2>
<p>You must be 18 or older and give your real email address. One person per account; keep your password to yourself.</p>

<h2>Exercise safely</h2>
<p>Stride is for fitness tracking, not medical advice. Check with a doctor before starting a new exercise routine. Stay aware of traffic and your surroundings, and don't use your phone while riding. GPS, distance, pace, elevation and step counts are estimates and can be wrong. Suggested routes come from map data that may be out of date: always check that a path is safe and that you're allowed to use it.</p>

<h2>Be respectful</h2>
<p>Don't harass, threaten or spam other people, impersonate anyone, or post illegal, hateful or sexual content. Don't upload activities you didn't do, or try to break, overload or access parts of Stride you're not meant to. You can block and report people from their profile. We may remove content or close accounts that break these rules.</p>

<h2>Your content</h2>
<p>You own the activities, comments and messages you add. You let us store and show them to the people you choose, so Stride can work. You can delete them at any time.</p>

<h2>The service</h2>
<p>Stride is free and provided "as is". We work to keep it running and your data safe, but we can't promise it will always be available or error-free, and we may change or stop features. To the extent the law allows, we're not liable for losses from using Stride.</p>

<h2>Leaving</h2>
<p>You can delete your account at any time from Settings. We may suspend accounts that break these terms.</p>
${contactLine()}`,
  );

export async function legalRoutes(app: FastifyInstance) {
  const html = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' };
  app.get('/privacy', async (_req, reply) => reply.headers(html).send(privacy()));
  app.get('/terms', async (_req, reply) => reply.headers(html).send(terms()));
}

// Builds the Stride app (apps/mobile) for web browsers and puts it in public/app, so the
// website serves it at /app. Runs before `next build` (see package.json "build").
//
// The web app is the same code as the iPhone and Android apps. app.config.js gives it the /app
// address when STRIDE_WEB_APP=1. If anything is missing afterwards the build stops, and
// Vercel keeps the previous version of the site online.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.resolve(webDir, '../mobile');
const out = path.join(webDir, 'public/app');

rmSync(out, { recursive: true, force: true });

const expoCli = createRequire(path.join(appDir, 'package.json')).resolve('expo/bin/cli');
execFileSync(process.execPath, [expoCli, 'export', '--platform', 'web', '--output-dir', out, '--clear'], {
  cwd: appDir,
  stdio: 'inherit',
  env: { ...process.env, STRIDE_WEB_APP: '1', NODE_ENV: 'production', CI: '1' },
});

// The map engine's background worker, served from our own site.
const mapWorker = createRequire(path.join(appDir, 'package.json')).resolve('maplibre-gl/dist/maplibre-gl-worker.mjs');
copyFileSync(mapWorker, path.join(out, 'maplibre-gl-worker.mjs'));

// A new cache name for every build, so phones drop the old version's files.
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);
const sw = path.join(out, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD_ID__', buildId));

// Check the result before the website build goes on.
const must = ['index.html', 'sw.js', 'manifest.webmanifest', 'maplibre-gl-worker.mjs', 'icons/apple-touch-icon.png'];
const missing = must.filter((f) => !existsSync(path.join(out, f)));
const html = existsSync(path.join(out, 'index.html')) ? readFileSync(path.join(out, 'index.html'), 'utf8') : '';
if (!/src="\/app\/_expo\/static\/js\/web\/[^"]+\.js"/.test(html)) missing.push('the app code link in index.html (with /app)');
if (!html.includes('rel="manifest"')) missing.push('the manifest link in index.html');
const bundles = existsSync(path.join(out, '_expo/static/js/web')) ? readdirSync(path.join(out, '_expo/static/js/web')) : [];
if (!bundles.some((f) => f.endsWith('.js'))) missing.push('the app code bundle');
if (missing.length) {
  console.error(`Web app build is incomplete, missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`Web app built into public/app (version ${buildId}).`);

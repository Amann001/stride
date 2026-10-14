// The app's settings live in app.json. This file changes nothing for the iPhone and Android
// apps: it only adds the web app's settings when the web app is built for the website
// (STRIDE_WEB_APP=1, see apps/web/scripts/build-web-app.mjs).
// - It lives at stride-amanswamy.vercel.app/app, so every link and file starts with /app.
// - It's a single-page app: the website sends every /app/... address to one index.html.
module.exports = ({ config }) => {
  if (process.env.STRIDE_WEB_APP !== '1') return config;
  return {
    ...config,
    web: { ...config.web, output: 'single' },
    experiments: { ...config.experiments, baseUrl: '/app' },
  };
};

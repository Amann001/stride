# Stride brand

**Colours:** lime `#C8F31D` on ink black `#121212`.
Lime is for fills and dark backgrounds. On white, use deep olive `#4D6B00` for text and links,
since lime text on white is hard to read.

**Wordmark font:** Montserrat Black, upright (free, SIL Open Font License). The lettering in these
files is converted to shapes, so it looks the same everywhere without installing the font.

**Opening screen:** the lime STRIDE wordmark centred on black, about 45% of the screen width
(`apps/mobile/assets/images/splash-wordmark.png`, 180 wide in `app.json`).

| File | Use it for |
|---|---|
| `stride-icon.svg` | App icon with rounded corners (website, social media, slides) |
| `stride-icon-square.svg` | Square app icon for app stores (iPhone rounds the corners itself) |
| `stride-logo-on-dark.svg` | Full logo (S + STRIDE) for dark backgrounds |
| `stride-logo-on-light.svg` | Full logo for white or light backgrounds |
| `stride-mark-lime.svg` / `stride-mark-black.svg` | The S symbol on its own |
| `stride-wordmark-lime.svg` / `stride-wordmark-black.svg` | The word STRIDE on its own |
| `preview.png` | Everything side by side, at different sizes |

Where the logo is used in the app:
- iPhone: `apps/mobile/assets/images/` (`icon.png`, `splash-icon.png`, `logo-on-*.png`, Android icons)
- Website: `apps/web/src/app/icon.svg` (browser tab), `apple-icon.png`, `apps/web/public/stride-logo-*.svg`

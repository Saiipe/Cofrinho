// Generates every app icon (PWA, Android launcher, Android splash) from the app artwork.
// Source: icon/Gato Pirata da Moeda Dourada.png (transparent background) composed on ICON_BG;
// falls back to a vector piggy bank when the artwork is missing.
// Rasterizes with a locally installed Chromium browser (Edge/Chrome) in headless mode.
// Usage: node scripts/generate-icons.mjs   (set CHROME_PATH to override the browser)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTWORK = join(root, 'icon', 'Gato Pirata da Moeda Dourada.png');
/** Background of the artwork's own composition ("Gato Pirata da Sorte"). */
const ICON_BG = '#4b4d53';
const SPLASH_BG = '#f6f7f9';

// Lucide "piggy-bank" (ISC license), used only without the artwork.
const GLYPH =
  '<path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/>';

const artwork = existsSync(ARTWORK) ? `data:image/png;base64,${readFileSync(ARTWORK).toString('base64')}` : null;

/** The artwork (or glyph) drawn centered at `fraction` of the canvas. */
function mark(size, fraction) {
  const px = size * fraction;
  const offset = (size - px) / 2;
  if (artwork) return `<image href="${artwork}" x="${offset}" y="${offset}" width="${px}" height="${px}"/>`;
  const glyphPx = px * 0.75;
  const glyphOffset = (size - glyphPx) / 2;
  return `<g transform="translate(${glyphOffset} ${glyphOffset}) scale(${glyphPx / 24})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>`;
}

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

// The artwork fills ~91% of its own canvas; fractions keep it inside each format's safe area.
const DESIGNS = {
  /** Rounded tile: favicon, PWA "any" icons, legacy Android launcher. */
  rounded: (s) => svg(s, `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${ICON_BG}"/>${mark(s, 0.84)}`),
  /** Full-bleed square, artwork inside the 80% safe circle (PWA maskable, Apple touch). */
  maskable: (s) => svg(s, `<rect width="${s}" height="${s}" fill="${ICON_BG}"/>${mark(s, 0.72)}`),
  round: (s) => svg(s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${ICON_BG}"/>${mark(s, 0.8)}`),
  /** Adaptive-icon foreground: 108dp canvas, artwork within the 66dp safe zone. */
  foreground: (s) => svg(s, mark(s, 0.62)),
  /** Pre-Android-12 launch background: light canvas with the rounded tile centered. */
  splash: (s) => svg(s, `<rect width="${s}" height="${s}" fill="${SPLASH_BG}"/><g transform="translate(${s * 0.4} ${s * 0.4})">${DESIGNS.rounded(s * 0.2).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`),
};

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('No Chromium browser found; set CHROME_PATH.');
  return found;
}

const browser = findBrowser();
const work = mkdtempSync(join(tmpdir(), 'cofrinho-icons-'));

function rasterize(design, size, out) {
  const svgFile = join(work, `${design}-${size}.svg`);
  writeFileSync(svgFile, DESIGNS[design](size));
  const html = join(work, `${design}-${size}.html`);
  writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><img src="${pathToFileURL(svgFile).href}" width="${size}" height="${size}" style="display:block"></body></html>`);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--default-background-color=00000000',
      `--user-data-dir=${join(work, 'profile')}`,
      `--window-size=${size},${size}`,
      `--screenshot=${out}`,
      pathToFileURL(html).href,
    ],
    { stdio: 'ignore' },
  );
  if (!existsSync(out)) throw new Error(`Failed to render ${out}`);
  console.log('icon', out.replace(root, '.'));
}

try {
  console.log(artwork ? `artwork: ${ARTWORK.replace(root, '.')}` : 'artwork missing: using the vector fallback');
  const pub = join(root, 'public');
  rasterize('rounded', 64, join(pub, 'favicon.png'));
  rasterize('rounded', 192, join(pub, 'icons/icon-192.png'));
  rasterize('rounded', 512, join(pub, 'icons/icon-512.png'));
  rasterize('maskable', 512, join(pub, 'icons/icon-maskable-512.png'));
  rasterize('maskable', 180, join(pub, 'icons/apple-touch-icon.png'));

  const res = join(root, 'android/app/src/main/res');
  if (existsSync(res)) {
    const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [density, scale] of Object.entries(densities)) {
      rasterize('rounded', 48 * scale, join(res, `mipmap-${density}/ic_launcher.png`));
      rasterize('round', 48 * scale, join(res, `mipmap-${density}/ic_launcher_round.png`));
      rasterize('foreground', 108 * scale, join(res, `mipmap-${density}/ic_launcher_foreground.png`));
    }
    rasterize('splash', 1280, join(res, 'drawable/splash.png'));
  } else {
    console.log('android/ not found: skipped launcher icons (run again after `npx cap add android`).');
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

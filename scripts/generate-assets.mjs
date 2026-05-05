// Generates all iOS + web + Capacitor app assets from two SVG sources.
// Run:  node scripts/generate-assets.mjs

import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const ICON_SVG = resolve(ROOT, "public/icon-source.svg");
const OG_SVG   = resolve(ROOT, "public/og-source.svg");
const OUT      = resolve(ROOT, "public/icons");
const RES_OUT  = resolve(ROOT, "resources");

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function png(svg, size, out, { padPct = 0, bg = null } = {}) {
  await ensureDir(dirname(out));
  let pipeline = sharp(svg, { density: 400 });
  if (padPct > 0) {
    const inner = Math.round(size * (1 - padPct * 2));
    const pad = Math.round((size - inner) / 2);
    const rendered = await sharp(svg, { density: 400 })
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pipeline = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bg || { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([{ input: rendered, top: pad, left: pad }]);
  } else {
    pipeline = pipeline.resize(size, size, { fit: "contain" });
    if (bg) pipeline = pipeline.flatten({ background: bg });
  }
  await pipeline.png().toFile(out);
  console.log("wrote", out.replace(ROOT, ""));
}

async function main() {
  await ensureDir(OUT);
  await ensureDir(RES_OUT);

  const iconBuf = await readFile(ICON_SVG);

  // ── iOS / web icon sizes ───────────────────────────────────────
  const sizes = {
    "icon-16.png":   16,
    "icon-20.png":   20,
    "icon-29.png":   29,
    "icon-32.png":   32,
    "icon-40.png":   40,
    "icon-58.png":   58,
    "icon-60.png":   60,
    "icon-76.png":   76,
    "icon-80.png":   80,
    "icon-87.png":   87,
    "icon-120.png": 120,
    "icon-152.png": 152,
    "icon-167.png": 167,
    "icon-180.png": 180,
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-256.png": 256,
    "icon-384.png": 384,
    "icon-512.png": 512,
    "icon-1024.png": 1024,
  };

  for (const [name, size] of Object.entries(sizes)) {
    await png(iconBuf, size, resolve(OUT, name));
  }

  // ── Maskable (PWA) — content in 80% safe zone ───────────────────
  for (const size of [192, 512]) {
    await png(iconBuf, size, resolve(OUT, `icon-${size}-maskable.png`), {
      padPct: 0.1,
      bg: { r: 0, g: 122, b: 255, alpha: 1 },
    });
  }

  // ── Capacitor iOS source asset (1024 no alpha per App Store rules) ──
  const appIconOpaque = sharp(iconBuf, { density: 400 })
    .resize(1024, 1024, { fit: "contain" })
    .flatten({ background: { r: 0, g: 122, b: 255, alpha: 1 } })
    .png();
  await appIconOpaque.toFile(resolve(RES_OUT, "icon-only.png"));
  console.log("wrote", resolve(RES_OUT, "icon-only.png").replace(ROOT, ""));

  // ── Capacitor splash (2732 for @capacitor/assets full set) ──────
  const splashBg = { r: 242, g: 242, b: 247, alpha: 1 };
  const splashSize = 2732;
  const logoSize = 512;
  const logoInPng = await sharp(iconBuf, { density: 400 })
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
  const splashBuf = await sharp({
    create: {
      width: splashSize,
      height: splashSize,
      channels: 4,
      background: splashBg,
    },
  })
    .composite([
      {
        input: logoInPng,
        top: Math.round((splashSize - logoSize) / 2),
        left: Math.round((splashSize - logoSize) / 2),
      },
    ])
    .png()
    .toBuffer();
  await writeFile(resolve(RES_OUT, "splash.png"), splashBuf);
  console.log("wrote resources/splash.png (2732x2732)");

  // web splash (iOS webclip fallback)
  await ensureDir(resolve(ROOT, "public/splash"));
  await writeFile(resolve(ROOT, "public/splash/splash-light.png"), splashBuf);

  // ── Favicon.ico (16/32/48) ──────────────────────────────────────
  const favSizes = [16, 32, 48];
  for (const s of favSizes) {
    await png(iconBuf, s, resolve(OUT, `favicon-${s}.png`));
  }
  // Next.js convention: public/favicon.ico
  await sharp(iconBuf, { density: 400 })
    .resize(48, 48, { fit: "contain" })
    .png()
    .toFile(resolve(ROOT, "public/favicon.ico"));
  console.log("wrote public/favicon.ico");

  // ── Open Graph image (1200x630 PNG) ─────────────────────────────
  const ogBuf = await readFile(OG_SVG);
  await sharp(ogBuf, { density: 300 })
    .resize(1200, 630, { fit: "contain" })
    .png()
    .toFile(resolve(ROOT, "public/og.png"));
  console.log("wrote public/og.png");

  console.log("\n✓ assets generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

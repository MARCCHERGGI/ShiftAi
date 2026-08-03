/**
 * Shift AI app icon generator.
 *   node scripts/gen-icons.mjs
 * Renders an iOS-style icon (blue gradient, white cocktail-glass glyph)
 * with sharp into:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/icon-512-maskable.png   (glyph inside the 80% safe zone)
 *   public/apple-touch-icon.png          (180x180, opaque — iOS rounds it)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");

/** Full-bleed 1024x1024 icon SVG. `glyphScale` shrinks the glyph for maskable. */
function iconSvg(glyphScale = 1) {
  const s = glyphScale;
  const cx = 512;
  const cy = 512;
  // martini glass, drawn around center, stroke-based
  const glyph = `
    <g transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})"
       stroke="#ffffff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"
       fill="none">
      <!-- bowl -->
      <path d="M 268 306 L 756 306 L 512 588 Z" />
      <!-- stem -->
      <path d="M 512 588 L 512 764" />
      <!-- base -->
      <path d="M 396 776 L 628 776" />
      <!-- garnish pick + olive -->
      <path d="M 448 214 L 560 348" stroke-width="34" />
      <circle cx="588" cy="382" r="42" fill="#ffffff" stroke="none" />
      <!-- sparkle (the AI) -->
      <path d="M 726 168 l 14 38 38 14 -38 14 -14 38 -14 -38 -38 -14 38 -14 Z"
            fill="#ffffff" stroke="none" />
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0A84FF" />
      <stop offset="1" stop-color="#007AFF" />
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28" />
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)" />
  <rect width="1024" height="1024" fill="url(#sheen)" />
  ${glyph}
</svg>`;
}

async function render(svg, size, outPath) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(outPath, png);
  console.log(`  ${outPath.replace(root, "").replaceAll("\\", "/")}  ${png.length} bytes`);
}

await mkdir(iconsDir, { recursive: true });

const standard = iconSvg(1);
const maskable = iconSvg(0.72); // keep glyph inside the maskable safe zone

console.log("Generating Shift AI icons:");
await render(standard, 192, join(iconsDir, "icon-192.png"));
await render(standard, 512, join(iconsDir, "icon-512.png"));
await render(maskable, 512, join(iconsDir, "icon-512-maskable.png"));
await render(standard, 180, join(root, "public", "apple-touch-icon.png"));
console.log("Done.");

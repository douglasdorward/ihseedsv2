// Reproducible static exports from the existing logo and homepage pasture photograph.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const publicDir = new URL("../../web/public/", import.meta.url);
const logo = await readFile(new URL("ih-seeds-logo.png", publicDir));
const pastureUrl = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=90";
const response = await fetch(pastureUrl);
if (!response.ok) throw new Error(`Pasture photo download failed: ${response.status}`);
const pasture = Buffer.from(await response.arrayBuffer());
// Crop the existing logo's sprout, not a newly drawn substitute.
const sprout = await sharp(logo).extract({ left: 130, top: 0, width: 43, height: 87 })
  .flatten({ background: "#ffffff" })
  .composite([{ input: Buffer.from('<svg width="43" height="87"><rect x="27" y="65" width="16" height="22" fill="white"/><rect x="0" y="72" width="4" height="15" fill="white"/></svg>') }])
  .png().toBuffer();
const icon = await sharp(sprout).resize(72, 144, { fit: "contain", background: "#ffffff" }).extend({
  top: 18, bottom: 18, left: 54, right: 54, background: "#ffffff",
}).flatten({ background: "#ffffff" }).png().toBuffer();
await writeFile(new URL("apple-touch-icon.png", publicDir), icon);
for (const size of [16, 32, 48]) {
  await sharp(icon).resize(size, size).png().toFile(new URL(`favicon-${size}x${size}.png`, publicDir).pathname);
}
// PNG-compressed ICO with three standard sizes.
const frames = await Promise.all([16, 32, 48].map(size => sharp(icon).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const p = 6 + i * 16;
  header[p] = [16, 32, 48][i];
  header[p + 1] = header[p];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(frame.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += frame.length;
});
await writeFile(new URL("favicon.ico", publicDir), Buffer.concat([header, ...frames]));
await writeFile(new URL("../../web/app/icon.svg", import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><image width="180" height="180" href="data:image/png;base64,${icon.toString("base64")}"/></svg>\n`);
const overlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="shade"><stop stop-color="#082f25" stop-opacity=".9"/><stop offset="1" stop-color="#082f25" stop-opacity=".28"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect x="64" y="52" width="230" height="154" rx="12" fill="white"/>
  <text x="64" y="319" fill="white" font-family="DejaVu Sans" font-size="45">Western Australia’s</text>
  <text x="64" y="392" fill="white" font-family="DejaVu Sans" font-weight="bold" font-size="62">Pasture Seed</text>
  <text x="64" y="466" fill="white" font-family="DejaVu Sans" font-weight="bold" font-size="62">Specialists</text>
  <rect x="64" y="508" width="76" height="5" fill="#f5bb20"/>
  <text x="64" y="566" fill="white" font-family="DejaVu Sans" font-size="23">irwinhunter.com.au</text>
</svg>`);
const logoCard = await sharp(logo).resize(190, 125, { fit: "contain", background: "white" }).png().toBuffer();
await sharp(pasture).resize(1200, 630, { fit: "cover" })
  .composite([{ input: overlay }, { input: logoCard, left: 84, top: 66 }])
  .jpeg({ quality: 90 }).toFile(new URL("social-share-default.jpg", publicDir).pathname);
console.log("Created shared brand icons and 1200×630 social card.");
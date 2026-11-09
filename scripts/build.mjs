import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => path.join(root, 'src', p);
const dist = path.join(root, 'dist');
const BG = { r: 10, g: 10, b: 10 };          // #0a0a0a, sampled from brand logo (opaque RGB file)
const FG = '#f7f7f7';                          // sampled logo body colour
const LOGO_RGBA = path.join(root, 'brand', 'LOGO MULTIBAG PNG...png'); // IHDR colortype 6, 3.49M pure-black transparent px
const LOGO_RGB = path.join(root, 'brand', 'LOGO MULTIBAG PNG.png');   // IHDR colortype 2

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

// The RGBA logo holds pure black (0,0,0) under fully transparent pixels. A straight-alpha resize would bleed
// that black into the edge and leave a dark halo, so every resize goes through premultiply -> resize -> unpremultiply.
async function logoAt(size, out) {
  const { data, info } = await sharp(LOGO_RGBA).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // crop to the alpha bounding box with 6% padding so the mark fills its square
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const side = Math.round(Math.max(x1 - x0, y1 - y0) * 1.12);
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
  const left = Math.max(0, Math.min(info.width - side, cx - Math.round(side / 2)));
  const top = Math.max(0, Math.min(info.height - side, cy - Math.round(side / 2)));
  const crop = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: side, height: side }).png().toBuffer();
  const buf = await premultResize(crop, size);
  if (out) fs.writeFileSync(out, buf);
  return buf;
}
async function premultResize(input, size) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, pm = Buffer.alloc(data.length);
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3] / 255; pm[i * 4] = Math.round(data[i * 4] * a); pm[i * 4 + 1] = Math.round(data[i * 4 + 1] * a); pm[i * 4 + 2] = Math.round(data[i * 4 + 2] * a); pm[i * 4 + 3] = data[i * 4 + 3]; }
  const r = await sharp(pm, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(r.data.length);
  for (let i = 0; i < r.info.width * r.info.height; i++) {
    const a = r.data[i * 4 + 3];
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, Math.round((r.data[i * 4 + c] * 255) / a));
    out[i * 4 + 3] = a;
  }
  return sharp(out, { raw: { width: r.info.width, height: r.info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

// favicon: trace the real 32x32 pixel grid of the logo into merged horizontal runs
async function favicon() {
  const buf = await logoAt(32);
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let d = '';
  for (let y = 0; y < 32; y++) {
    let x = 0;
    while (x < 32) {
      if (data[(y * 32 + x) * 4 + 3] >= 128) { let w = 1; while (x + w < 32 && data[(y * 32 + x + w) * 4 + 3] >= 128) w++; d += `M${x} ${y}h${w}v1h-${w}z`; x += w; } else x++;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges"><rect width="32" height="32" rx="6" fill="#0a0a0a"/><path fill="${FG}" d="${d}"/></svg>\n`;
  if (svg.includes('--')) throw new Error('favicon contains a double hyphen');
  fs.writeFileSync(path.join(dist, 'favicon.svg'), svg);
}

async function images() {
  await logoAt(96, path.join(dist, 'assets', 'logo-96.png'));
  await logoAt(512, path.join(dist, 'assets', 'logo-512.png'));
  const t = await logoAt(132);
  fs.writeFileSync(path.join(dist, 'assets', 'apple-touch-icon.png'),
    await sharp({ create: { width: 180, height: 180, channels: 3, background: BG } }).composite([{ input: t, gravity: 'center' }]).png().toBuffer());
  const mark = await logoAt(440);
  fs.writeFileSync(path.join(dist, 'assets', 'og.png'),
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: BG } }).composite([{ input: mark, gravity: 'center' }]).png({ compressionLevel: 9 }).toBuffer());
  // keep the opaque brand file available as a flat fallback
  fs.copyFileSync(LOGO_RGB, path.join(dist, 'assets', 'logo-flat.png'));
}

function copy() {
  for (const f of ['index.html', 'styles.css', 'app.js', 'registers.js']) fs.copyFileSync(src(f), path.join(dist, f));
  fs.writeFileSync(path.join(dist, 'site.webmanifest'), JSON.stringify({ name: 'MULTIBAG', short_name: 'MULTIBAG', start_url: '/', display: 'standalone', background_color: '#0a0a0a', theme_color: '#0a0a0a', icons: [{ src: '/assets/logo-512.png', sizes: '512x512', type: 'image/png' }] }));
  fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  fs.writeFileSync(path.join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
}

function verify() {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const dateLike = /\b(19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}:\d{2}(:\d{2})?\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/;
  const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
  if (dateLike.test(visible)) throw new Error('date or timestamp found in page text');
  for (const f of ['favicon.svg', 'assets/logo-96.png', 'assets/og.png', 'app.js', 'registers.js', 'styles.css']) if (!fs.existsSync(path.join(dist, f))) throw new Error('missing ' + f);
}

await images();
await favicon();
copy();
verify();
console.log('dist/ ready:', fs.readdirSync(dist).join(', '));

// Image helpers for build.js.
// - Reads width and height from JPEG, PNG, WebP and GIF files, so pages
//   reserve the right space and never crop or stretch an image.
// - If the free "sharp" library is installed (the GitHub Actions workflow
//   installs it), also writes smaller WebP copies (640, 1280, 1920 px wide)
//   to assets/resized/, so phones download smaller files. Never enlarges.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let sharp = null;
try { sharp = require("sharp"); } catch (e) { /* optional */ }

const WIDTHS = [640, 960, 1280, 1920];

function readSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  }
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") {
    return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

module.exports = function createImages(root) {
  const warnings = [];
  const jobs = []; // resize jobs, run after the pages are prepared
  const cache = new Map();

  // Turns a value saved by the admin panel ("/assets/uploads/x.webp") into
  // { src, w, h, srcset } or null when empty or missing.
  function image(value, where) {
    if (!value || typeof value !== "string") return null;
    if (/^[a-z]+:/i.test(value)) {
      warnings.push(`${where}: external image addresses are not used (${value})`);
      return null;
    }
    const rel = value.replace(/^\/+/, "");
    // Only ordinary pictures: an SVG (or any other file) could carry a script
    // that runs on the site when its link is opened. The admin panel accepts
    // only these too (admin/config.yml, accept).
    if (!/\.(jpe?g|png|webp|gif)$/i.test(rel)) {
      warnings.push(`${where}: only JPEG, PNG, WebP or GIF pictures are used (${value})`);
      return null;
    }
    if (cache.has(rel)) return { ...cache.get(rel) };
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      warnings.push(`${where}: image not found (${value})`);
      return null;
    }
    const size = readSize(file);
    if (!size) warnings.push(`${where}: could not read image size (${value})`);
    const rec = { src: rel, full: rel, w: size ? size.w : null, h: size ? size.h : null, srcset: "" };

    if (sharp && size && /\.(jpe?g|png|webp)$/i.test(rel)) {
      const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
      const name = path.basename(rel).replace(/\.[^.]+$/, "");
      const parts = [];
      const heavyFile = fs.statSync(file).size > 1.5 * 1024 * 1024;
      // A heavy original also gets a WebP copy at its own full width, so the
      // sharpest version stays available without the heavy file.
      const widths = WIDTHS.filter((w) => w < size.w);
      if (heavyFile && size.w < WIDTHS[WIDTHS.length - 1] && !widths.includes(size.w)) widths.push(size.w);
      for (const w of widths) {
        const outRel = `assets/resized/${name}-${hash}-${w}.webp`;
        jobs.push({ file, out: path.join(root, outRel), w });
        parts.push(`${outRel} ${w}w`);
      }
      if (parts.length) {
        // Heavy originals (over 1.5 MB, e.g. large PNG files) are not offered
        // to browsers: the largest WebP copy is used instead. Light originals
        // stay the sharpest choice. The original file itself is never changed.
        const heavy = heavyFile;
        rec.srcset = (heavy ? parts : [...parts, `${rel} ${size.w}w`]).join(", ");
        if (heavy) rec.full = parts[parts.length - 1].split(" ")[0];
      }
    }
    cache.set(rel, rec);
    return { ...rec };
  }

  // A sharing picture (Facebook, WhatsApp, X…): 1200×630 JPEG, the whole
  // picture on the site's paper colour (never cropped), about 100–300 KB
  // instead of a 2–3 MB original. Without sharp: null (the original is used).
  const shares = new Map();
  function share(rec) {
    if (!sharp || !rec || !rec.src) return null;
    if (shares.has(rec.src)) return shares.get(rec.src);
    const file = path.join(root, rec.src);
    if (!fs.existsSync(file) || !/\.(jpe?g|png|webp)$/i.test(rec.src)) return null;
    const hash = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
    const outRel = `assets/share/${path.basename(rec.src).replace(/\.[^.]+$/, "")}-${hash}.jpg`;
    jobs.push({ file, out: path.join(root, outRel), share: true });
    const out = { src: outRel, w: 1200, h: 630, alt: rec.alt || "" };
    shares.set(rec.src, out);
    return out;
  }

  async function runJobs() {
    if (!jobs.length) return 0;
    fs.mkdirSync(path.join(root, "assets/resized"), { recursive: true });
    fs.mkdirSync(path.join(root, "assets/share"), { recursive: true });
    let made = 0;
    for (const j of jobs) {
      if (fs.existsSync(j.out)) continue;
      if (j.share) {
        await sharp(j.file).resize(1200, 630, { fit: "contain", background: "#f7f6ef" }).flatten({ background: "#f7f6ef" }).jpeg({ quality: 82, mozjpeg: true }).toFile(j.out);
      } else {
        await sharp(j.file).resize({ width: j.w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(j.out);
      }
      made++;
    }
    return made;
  }

  return { image, share, runJobs, warnings, hasSharp: !!sharp };
};

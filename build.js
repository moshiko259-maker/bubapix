#!/usr/bin/env node
// Builds the English and Hebrew homepages.
//
//   node build.js
//
// Reads:   content/site.json   images, project names and short texts
//                              (edited in the admin panel at /admin/)
//          src/i18n/en.json    interface labels (menu, headings, notes)
//          src/i18n/he.json
// Writes:  index.html          English, served at /bubapix/
//          he/index.html       Hebrew,  served at /bubapix/he/
//
// The GitHub Actions workflow in .github/workflows/build-pages.yml runs this
// automatically after every change saved from the admin panel.

const fs = require("fs");
const path = require("path");
const render = require("./src/template.js");

// ---- Site settings -------------------------------------------------
const site = {
  // Full public address of the English homepage, ending with "/".
  // Change to "https://bubapix.com/" once the custom domain is connected.
  url: "https://moshiko259-maker.github.io/bubapix/",
};
// --------------------------------------------------------------------

const root = __dirname;
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const en = readJson("src/i18n/en.json");
const he = readJson("src/i18n/he.json");
const content = readJson("content/site.json");

// ---- Interface labels: fail if one language is missing a key ----------
function shape(obj, prefix = "") {
  if (Array.isArray(obj)) {
    return [`${prefix}[${obj.length}]`, ...obj.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  }
  if (obj && typeof obj === "object") {
    return Object.keys(obj).flatMap((k) => shape(obj[k], prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}
{
  const a = new Set(shape(en));
  const b = new Set(shape(he));
  const missingInHe = [...a].filter((k) => !b.has(k));
  const missingInEn = [...b].filter((k) => !a.has(k));
  if (missingInHe.length || missingInEn.length) {
    if (missingInHe.length) console.error("Missing in he.json:", missingInHe.join(", "));
    if (missingInEn.length) console.error("Missing in en.json:", missingInEn.join(", "));
    process.exit(1);
  }
}

// ---- Images --------------------------------------------------------------
// Reads width and height from JPEG, PNG, WebP and GIF headers, so the page
// can reserve the right space for each image and never crop or stretch it.
function imageSize(file) {
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
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      // SOF0..SOF15, excluding DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

// Turns a path saved by the admin panel ("/assets/uploads/x.webp" or
// "assets/uploads/x.webp") into an image record, or null if it is empty
// or the file is missing.
const warnings = [];
function image(value, where) {
  if (!value || typeof value !== "string") return null;
  if (/^https?:\/\//.test(value)) {
    warnings.push(`${where}: external image URLs are not used (${value})`);
    return null;
  }
  const rel = value.replace(/^\/+/, "");
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    warnings.push(`${where}: image not found (${value})`);
    return null;
  }
  const size = imageSize(file);
  if (!size) warnings.push(`${where}: could not read image size (${value})`);
  return { src: rel, w: size ? size.w : null, h: size ? size.h : null };
}

// Picks the text for one language, falling back to the other language
// so a missing translation never leaves a blank title.
const pick = (obj, key, lang) => {
  const own = (obj[`${key}_${lang}`] || "").trim();
  const other = (obj[`${key}_${lang === "he" ? "en" : "he"}`] || "").trim();
  return own || other;
};

function viewModel(lang) {
  const projects = (content.projects || []).map((p, i) => {
    const title = pick(p, "title", lang) || `Project ${i + 1}`;
    const cover = image(p.cover, `projects[${i}] "${title}" cover`);
    if (cover) cover.alt = pick(p, "cover_alt", lang) || title;
    const gallery = (p.gallery || [])
      .map((g, j) => {
        const img = image(g.image, `projects[${i}] "${title}" gallery[${j}]`);
        if (img) img.alt = pick(g, "alt", lang) || title;
        return img;
      })
      .filter(Boolean);
    return { title, text: pick(p, "text", lang), featured: !!p.featured, cover, gallery };
  });

  const hero = image(content.hero_image, "hero_image");
  if (hero) hero.alt = pick(content, "hero_alt", lang);

  const email = (content.contact_email || "").trim();
  return {
    hero,
    tagline: pick(content, "tagline", lang),
    about: pick(content, "about", lang),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    featured: projects.filter((p) => p.featured),
    others: projects.filter((p) => !p.featured),
  };
}

// ---- Pages ---------------------------------------------------------------
const urls = { en: site.url, he: site.url + "he/" };

const pages = [
  {
    lang: "en", dir: "ltr", t: en, base: "", file: "index.html",
    other: { lang: "he", href: "he/", t: he },
  },
  {
    lang: "he", dir: "rtl", t: he, base: "../", file: "he/index.html",
    other: { lang: "en", href: "../?lang=en", t: en },
  },
];

for (const p of pages) {
  const html = render({ ...p, c: viewModel(p.lang), urls, site });
  const out = path.join(root, p.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${p.file} (${(html.length / 1024).toFixed(1)} KB)`);
}

for (const w of [...new Set(warnings)]) console.warn("Warning:", w);

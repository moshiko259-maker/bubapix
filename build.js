#!/usr/bin/env node
// Builds every page of the BubaPix site, in English and Hebrew.
//
//   node build.js                   clean addresses (for the live site)
//   node build.js --preview-links   links end in index.html (for previews)
//
// Reads   content/*.json, content/projects/*.json, content/testimonials/*.json,
//         content/pages/*.json  (all edited in the admin panel at /admin/)
//         src/i18n/en.json, src/i18n/he.json  (interface labels)
// Writes  index.html, work/…, services/, about/, testimonials/, contact/,
//         pages/…, and the same under he/; plus 404.html, sitemap.xml, robots.txt.
//
// Pages that no longer exist (for example a deleted project) are removed.
// Only files this script wrote before are ever removed; the list is kept in
// .generated-files.json.

const fs = require("fs");
const path = require("path");
const render = require("./src/render.js");
const createImages = require("./src/images.js");

// ---- Site settings -------------------------------------------------
const site = {
  // Full public address of the English homepage, ending with "/".
  // Change to "https://bubapix.com/" once the custom domain is connected.
  url: "https://moshiko259-maker.github.io/bubapix/",
  // Optional: paste an analytics snippet here later (for example a free,
  // privacy-friendly service). Leave empty to load no analytics at all.
  analyticsHead: "",
};
// --------------------------------------------------------------------

const root = __dirname;
const preview = process.argv.includes("--preview-links") || process.env.BUILD_PREVIEW_LINKS === "1";

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const readJsonOr = (p, fallback) => (fs.existsSync(path.join(root, p)) ? readJson(p) : fallback);
const readFolder = (dir) => {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ slug: f.replace(/\.json$/, ""), ...readJson(path.join(dir, f)) }));
};

const t = { en: readJson("src/i18n/en.json"), he: readJson("src/i18n/he.json") };

// ---- Interface labels: fail if one language is missing a key ----------
function shape(obj, prefix = "") {
  if (Array.isArray(obj)) return [`${prefix}[]`, ...obj.flatMap((v) => shape(v, `${prefix}[]`))];
  if (obj && typeof obj === "object") return Object.keys(obj).flatMap((k) => shape(obj[k], prefix ? `${prefix}.${k}` : k));
  return [prefix];
}
{
  const a = new Set(shape(t.en));
  const b = new Set(shape(t.he));
  const missingInHe = [...a].filter((k) => !b.has(k));
  const missingInEn = [...b].filter((k) => !a.has(k));
  if (missingInHe.length || missingInEn.length) {
    if (missingInHe.length) console.error("Missing in he.json:", missingInHe.join(", "));
    if (missingInEn.length) console.error("Missing in en.json:", missingInEn.join(", "));
    process.exit(1);
  }
}

// ---- Content ---------------------------------------------------------------
const raw = {
  site: readJsonOr("content/site.json", {}),
  services: readJsonOr("content/services.json", { services: [], process: [] }),
  about: readJsonOr("content/about.json", { team: [] }),
  contact: readJsonOr("content/contact.json", { social: [] }),
  categories: readJsonOr("content/categories.json", { categories: [] }).categories || [],
  projects: readFolder("content/projects"),
  testimonials: readFolder("content/testimonials"),
  pages: readFolder("content/pages"),
};

const images = createImages(root);
const safeSlug = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);
const visible = (x) => x.visible !== false;
const byOrder = (a, b) =>
  (Number(a.order) || 9999) - (Number(b.order) || 9999) || String(a.title_en || a.name || "").localeCompare(String(b.title_en || b.name || ""));

for (const list of [raw.projects, raw.pages]) {
  for (const x of list) {
    if (!safeSlug(x.slug)) console.warn(`Warning: skipped "${x.slug}" (file names must use a-z, 0-9 and dashes)`);
  }
}

// Text for one language, falling back to the other language so a missing
// translation never leaves a blank.
const pick = (obj, key, lang) => {
  const own = String(obj[`${key}_${lang}`] || "").trim();
  const other = String(obj[`${key}_${lang === "he" ? "en" : "he"}`] || "").trim();
  return own || other;
};

function parseVideo(url) {
  if (!url) return null;
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(url);
  if (m) return { kind: "youtube", id: m[1] };
  m = /vimeo\.com\/(?:video\/)?(\d{5,12})/.exec(url);
  if (m) return { kind: "vimeo", id: m[1] };
  return null;
}

function contentFor(lang) {
  const s = raw.site;
  const imgWithAlt = (value, alt, where) => {
    const im = images.image(value, where);
    if (im) im.alt = alt;
    return im;
  };
  const categories = raw.categories
    .filter((c) => c && safeSlug(c.slug || ""))
    .map((c) => ({ slug: c.slug, name: pick(c, "name", lang) || c.slug }));
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  const projects = raw.projects
    .filter((p) => visible(p) && safeSlug(p.slug))
    .sort(byOrder)
    .map((p) => {
      const title = pick(p, "title", lang) || p.slug;
      if (p.video_url && !parseVideo(p.video_url)) images.warnings.push(`project "${p.slug}": video link is not a YouTube or Vimeo address`);
      const videoFile = typeof p.video_file === "string" && /\.(mp4|webm)$/i.test(p.video_file) && fs.existsSync(path.join(root, p.video_file.replace(/^\/+/, "")))
        ? p.video_file.replace(/^\/+/, "")
        : "";
      return {
        slug: p.slug,
        title,
        text: pick(p, "text", lang),
        description: pick(p, "description", lang),
        featured: !!p.featured,
        categories: (Array.isArray(p.categories) ? p.categories : []).map((c) => catBySlug.get(c)).filter(Boolean),
        cover: imgWithAlt(p.cover, pick(p, "cover_alt", lang) || title, `project "${p.slug}" cover`),
        video: parseVideo(p.video_url),
        videoFile,
        gallery: (p.gallery || [])
          .map((g, i) => imgWithAlt(g.image, pick(g, "alt", lang) || title, `project "${p.slug}" image ${i + 1}`))
          .filter(Boolean),
        details: (p.details || [])
          .map((d) => ({ label: pick(d, "label", lang), value: pick(d, "value", lang) }))
          .filter((d) => d.label && d.value),
      };
    });

  return {
    hero: imgWithAlt(s.hero_image, pick(s, "hero_alt", lang), "main image"),
    tagline: pick(s, "tagline", lang),
    intro: pick(s, "intro", lang),
    seoDescription: pick(s, "seo_description", lang) || pick(s, "intro", lang),
    categories,
    projects,
    services: {
      intro: pick(raw.services, "intro", lang),
      items: (raw.services.services || []).map((x) => ({ name: pick(x, "name", lang), text: pick(x, "text", lang) })).filter((x) => x.name),
      processTitle: pick(raw.services, "process_title", lang),
      process: (raw.services.process || []).map((x) => ({ name: pick(x, "name", lang), text: pick(x, "text", lang) })).filter((x) => x.name),
    },
    about: {
      body: pick(raw.about, "body", lang),
      team: (raw.about.team || [])
        .filter((m) => m && m.name)
        .map((m, i) => ({
          name: m.name,
          role: pick(m, "role", lang),
          bio: pick(m, "bio", lang),
          photo: imgWithAlt(m.photo, m.name, `team member ${i + 1}`),
        })),
    },
    testimonials: raw.testimonials
      .filter(visible)
      .sort(byOrder)
      .map((q) => ({ quote: pick(q, "quote", lang), name: q.name || "", role: pick(q, "role", lang) }))
      .filter((q) => q.quote && q.name),
    contact: {
      intro: pick(raw.contact, "intro", lang),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw.contact.email || "").trim()) ? raw.contact.email.trim() : "",
      phone: String(raw.contact.phone || "").trim(),
      location: pick(raw.contact, "location", lang),
      social: (raw.contact.social || []).filter((x) => x && x.label && /^https:\/\//.test(x.url || "")),
    },
    pages: raw.pages
      .filter((p) => visible(p) && safeSlug(p.slug))
      .sort(byOrder)
      .map((p) => ({
        slug: p.slug,
        title: pick(p, "title", lang) || p.slug,
        body: pick(p, "body", lang),
        description: pick(p, "description", lang),
        menu: !!p.show_in_menu,
      })),
  };
}

// ---- Pages ---------------------------------------------------------------
const outputs = new Map(); // relative file path -> contents

function contextFor(lang, pagePath, data) {
  const segments = pagePath.split("/").filter(Boolean).length;
  const up = (n) => "../".repeat(n);
  const assetBase = up(segments + (lang === "he" ? 1 : 0));
  return {
    t: t[lang],
    otherT: t[lang === "he" ? "en" : "he"],
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    path: pagePath,
    base: up(segments),
    assetBase,
    otherBase: lang === "he" ? assetBase : assetBase + "he/",
    site,
    preview,
    data,
  };
}

const sitemap = [];
for (const lang of ["en", "he"]) {
  const data = contentFor(lang);
  const add = (pagePath, html) => {
    outputs.set((lang === "he" ? "he/" : "") + pagePath + "index.html", html);
    if (lang === "en") sitemap.push(pagePath);
  };
  add("", render.home(contextFor(lang, "", data)));
  add("work/", render.work(contextFor(lang, "work/", data)));
  data.projects.forEach((p, i) => {
    const pagePath = `work/${p.slug}/`;
    add(pagePath, render.project(contextFor(lang, pagePath, data), p, data.projects[i - 1], data.projects[i + 1]));
  });
  add("services/", render.services(contextFor(lang, "services/", data)));
  add("about/", render.about(contextFor(lang, "about/", data)));
  if (data.testimonials.length) add("testimonials/", render.testimonials(contextFor(lang, "testimonials/", data)));
  add("contact/", render.contact(contextFor(lang, "contact/", data)));
  data.pages.forEach((p) => {
    const pagePath = `pages/${p.slug}/`;
    add(pagePath, render.customPage(contextFor(lang, pagePath, data), p));
  });
}

outputs.set("404.html", render.notFound(site, t.en, t.he, preview));

const today = new Date().toISOString().slice(0, 10);
outputs.set(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap
  .flatMap((p) => ["", "he/"].map((l) => `  <url>
    <loc>${site.url}${l}${p}</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${site.url}${p}"/>
    <xhtml:link rel="alternate" hreflang="he" href="${site.url}he/${p}"/>
  </url>`))
  .join("\n")}
</urlset>
`
);

const sitePath = new URL(site.url).pathname; // "/bubapix/" now, "/" on bubapix.com
outputs.set("robots.txt", `User-agent: *\nDisallow: ${sitePath}admin/\n\nSitemap: ${site.url}sitemap.xml\n`);

// ---- Write -----------------------------------------------------------------
(async () => {
  const made = await images.runJobs();

  const manifestFile = path.join(root, ".generated-files.json");
  const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : [];

  for (const [rel, html] of outputs) {
    const out = path.join(root, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }

  // Remove pages this script wrote last time but no longer produces.
  let removed = 0;
  for (const rel of previous) {
    if (outputs.has(rel) || !/^(he\/)?((work|services|about|testimonials|contact|pages)\/.*)?index\.html$/.test(rel)) continue;
    const full = path.join(root, rel);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      removed++;
      // Remove now-empty folders left behind.
      let dir = path.dirname(full);
      while (dir.startsWith(root + path.sep) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      }
    }
  }
  fs.writeFileSync(manifestFile, JSON.stringify([...outputs.keys()].sort(), null, 2) + "\n");

  console.log(
    `Built ${outputs.size} files (${[...outputs.keys()].filter((k) => k.endsWith("index.html")).length} pages)` +
      `${preview ? ", preview links" : ""}${removed ? `, removed ${removed} old pages` : ""}` +
      `${images.hasSharp ? `, ${made} new resized images` : ", no resized images (sharp not installed)"}`
  );
  for (const w of [...new Set(images.warnings)]) console.warn("Warning:", w);
})();

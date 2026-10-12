#!/usr/bin/env node
// Builds every page of the BubaPix site, in English and Hebrew.
//
//   node build.js                   clean addresses (for the live site)
//   node build.js --preview-links   links end in index.html (for previews)
//
// Reads   content/*.json, content/projects/*.json, content/testimonials/*.json,
//         content/pages/*.json  (all edited in the admin panel at /admin/)
//         src/i18n/en.json, src/i18n/he.json  (interface labels)
// Writes  index.html, work/…, services/, about/, testimonials/, contact/, ideas/, privacy/,
//         pages/…, and the same under he/; plus 404.html, sitemap.xml, robots.txt.
//
// Pages that are no longer produced (for example a hidden project) are not
// deleted: they are replaced by a short "page not found" notice. The list of
// pages this script writes is kept in .generated-files.json.

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
  // Note: the pages carry a Content-Security-Policy. An analytics snippet
  // pasted here turns that policy off, because it would block the snippet.
  analyticsHead: "",
  // Visitor comments, ratings and forms (Supabase, free plan).
  // The key below is the PUBLIC "anon" key: it is designed to be visible in
  // the browser and can only call what the database rules allow (send a
  // message for review, read approved messages, rate once). Never put the
  // "service_role" key or any other secret here.
  community: {
    url: "https://ouskvcsmcddgdukcofex.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2t2Y3NtY2RkZ2R1a2NvZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDUxNjAsImV4cCI6MjEwNzMyMTE2MH0.SnJUMrnVZ_XzqBYRJP0DoySp8Fc9qg4BBQA9xQE8giA",
  },
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
  // Visitor participation switches (admin: Settings > Visitor participation).
  // Everything is off unless switched on there.
  participation: readJsonOr("content/participation.json", {}),
  // Optional replacements for headings and menu names (Settings > Interface texts).
  labels: readJsonOr("content/labels.json", {}),
  projects: readFolder("content/projects"),
  products: readFolder("content/products"),
  shop: readJsonOr("content/shop.json", { categories: [] }),
  testimonials: readFolder("content/testimonials"),
  pages: readFolder("content/pages"),
};

// Headings and menu names changed in the admin replace the usual labels.
{
  const L = raw.labels || {};
  const set = (lang, obj, key, field) => {
    const v = String(L[`${field}_${lang}`] || "").trim();
    if (v) obj[key] = v;
  };
  for (const lang of ["en", "he"]) {
    const tl = t[lang];
    set(lang, tl.home, "workTitle", "work_heading");
    set(lang, tl.home, "startProject", "start_project");
    set(lang, tl.nav, "work", "nav_work");
    set(lang, tl.work, "title", "nav_work");
    set(lang, tl.nav, "services", "nav_services");
    set(lang, tl.services, "title", "nav_services");
    set(lang, tl.nav, "about", "nav_about");
    set(lang, tl.about, "title", "nav_about");
    set(lang, tl.nav, "contact", "nav_contact");
    set(lang, tl.contact, "title", "nav_contact");
    for (const k of ["synopsis", "creators", "behind", "gallery", "video", "details"]) set(lang, tl.work, k, k);
  }
}

const participation = {
  comments: raw.participation.comments === true,
  ratings: raw.participation.ratings === true,
  ideas: raw.participation.ideas === true,
  consult: raw.participation.consult === true,
};
participation.any = participation.comments || participation.ratings || participation.ideas || participation.consult;

const images = createImages(root);
const safeSlug = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);
const visible = (x) => x.visible !== false;
const byOrder = (a, b) =>
  (Number(a.order) || 9999) - (Number(b.order) || 9999) || String(a.title_en || a.name || "").localeCompare(String(b.title_en || b.name || ""));

for (const list of [raw.projects, raw.pages, raw.products]) {
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

  // One picture with its optional title and note.
  //   caption: "hidden" (default) | "project" (project page) | "everywhere"
  //   on_home: also show it in the homepage gallery
  const picture = (g, fallbackAlt, where) => {
    if (!g) return null;
    const im = images.image(typeof g === "string" ? g : g.image, where);
    if (!im) return null;
    const o = typeof g === "string" ? {} : g;
    const title = pick(o, "title", lang);
    im.caption = ["project", "everywhere"].includes(o.caption) ? o.caption : "hidden";
    // A title marked "hidden" stays hidden everywhere, also from screen readers.
    im.alt = pick(o, "alt", lang) || (im.caption !== "hidden" ? title : "") || fallbackAlt;
    im.title = title;
    im.note = pick(o, "note", lang);
    im.onHome = o.on_home === true;
    return im;
  };

  const projects = raw.projects
    .filter((p) => visible(p) && safeSlug(p.slug))
    .sort(byOrder)
    .map((p) => {
      // The name is written once and used on both sites, unless a different
      // Hebrew name is given. It can be hidden (image-only projects).
      const name = lang === "he" ? String(p.title_he || "").trim() || String(p.title_en || "").trim() : String(p.title_en || "").trim() || String(p.title_he || "").trim();
      const title = name || p.slug;
      const where = `project "${p.slug}"`;
      const videoOf = (v, i) => {
        const url = typeof v === "string" ? v : v.url;
        const file = typeof v === "string" ? "" : v.file;
        const parsed = parseVideo(url);
        if (url && !parsed) images.warnings.push(`${where}: video ${i + 1} is not a YouTube or Vimeo address`);
        const local = typeof file === "string" && /\.(mp4|webm)$/i.test(file) && fs.existsSync(path.join(root, file.replace(/^\/+/, ""))) ? file.replace(/^\/+/, "") : "";
        if (!parsed && !local) return null;
        return { embed: parsed, file: local, title: typeof v === "string" ? "" : pick(v, "title", lang) };
      };

      // Optional sections, in the order chosen in the admin.
      const sections = [];
      for (const [i, sec] of (Array.isArray(p.sections) ? p.sections : []).entries()) {
        if (!sec || sec.hidden === true) continue;
        const heading = pick(sec, "heading", lang);
        const at = `${where} section ${i + 1}`;
        if (sec.type === "creators") {
          const items = (sec.items || []).filter((c) => c && c.name).map((c) => ({ name: lang === "he" ? String(c.name_he || "").trim() || c.name : c.name, role: pick(c, "role", lang), text: pick(c, "text", lang) })).filter((c) => c.text || c.role);
          if (items.length) sections.push({ type: "creators", heading, items });
        } else if (sec.type === "behind" || sec.type === "gallery") {
          const pics = (sec.images || []).map((g, j) => picture(g, title, `${at} image ${j + 1}`)).filter(Boolean);
          const body = sec.type === "behind" ? pick(sec, "body", lang) : "";
          if (pics.length || body) sections.push({ type: sec.type, heading, body, images: pics });
        } else if (sec.type === "videos") {
          const vids = (sec.items || []).map(videoOf).filter(Boolean);
          if (vids.length) sections.push({ type: "videos", heading, videos: vids });
        } else if (sec.type === "text") {
          const body = pick(sec, "body", lang);
          if (body) sections.push({ type: "text", heading, body });
        } else if (sec.type === "details") {
          const items = (sec.items || []).map((d) => ({ label: pick(d, "label", lang), value: pick(d, "value", lang) })).filter((d) => d.label && d.value);
          if (items.length) sections.push({ type: "details", heading, items });
        }
      }
      // Older fields (before sections existed) still work.
      const oldVideo = videoOf({ url: p.video_url, file: p.video_file }, 0);
      if (oldVideo) sections.unshift({ type: "videos", heading: "", videos: [oldVideo] });
      const oldGallery = (p.gallery || []).map((g, j) => picture(g, title, `${where} image ${j + 1}`)).filter(Boolean);
      if (oldGallery.length) sections.push({ type: "gallery", heading: "", images: oldGallery });
      const oldDetails = (p.details || []).map((d) => ({ label: pick(d, "label", lang), value: pick(d, "value", lang) })).filter((d) => d.label && d.value);
      if (oldDetails.length) sections.push({ type: "details", heading: "", items: oldDetails });

      const cover = picture({ image: p.cover, alt_en: p.cover_alt_en, alt_he: p.cover_alt_he }, title, `${where} cover`);
      const pictures = sections.filter((x) => x.images).flatMap((x) => x.images);
      return {
        slug: p.slug,
        title,
        name,
        showTitle: p.show_title !== false && !!name,
        titleInGallery: p.title_in_gallery === true && !!name,
        text: pick(p, "text", lang),
        description: pick(p, "description", lang),
        seoTitle: pick(p, "seo_title", lang),
        seoDescription: pick(p, "seo_description", lang),
        featured: p.featured !== false,
        comments: p.comments !== false,
        categories: (Array.isArray(p.categories) ? p.categories : []).map((c) => catBySlug.get(c)).filter(Boolean),
        cover,
        // The picture that represents the project in galleries.
        thumb: cover || pictures[0] || null,
        pictures,
        sections,
      };
    })
    // A project without any image is not shown anywhere (no half-finished pages).
    .filter((p) => {
      if (!p.thumb) images.warnings.push(`project "${p.slug}" is not shown yet: it has no image`);
      return !!p.thumb;
    });

  // Homepage gallery: each chosen project's main picture, then the pictures
  // marked "Also show in the homepage gallery". The same file is never shown twice.
  const seen = new Set();
  const homeGallery = [];
  const addHome = (im, project, caption) => {
    if (!im || seen.has(im.src)) return;
    seen.add(im.src);
    homeGallery.push({ image: im, project, caption });
  };
  const hero = imgWithAlt(s.hero_image, pick(s, "hero_alt", lang), "opening image");
  const pictureCaption = (im) => (im.caption === "everywhere" && (im.title || im.note) ? { title: im.title, note: im.note } : null);
  // Homepage gallery chosen in the admin (Homepage > Homepage gallery). These
  // pictures are shown on their own, without links. When the list is empty,
  // the chosen projects' pictures are used instead.
  for (const [i, g] of (Array.isArray(s.gallery) ? s.gallery : []).entries()) {
    if (!g || g.visible === false) continue;
    const im = picture(g, "BubaPix", `homepage gallery image ${i + 1}`);
    if (im) addHome(im, null, pictureCaption(im));
  }
  for (const p of homeGallery.length ? [] : projects.filter((x) => x.featured)) {
    const nameCaption = p.titleInGallery ? { title: p.name, note: "" } : null;
    const coverCaption = p.cover ? nameCaption : pictureCaption(p.thumb) || nameCaption;
    // The opening image, if it belongs to this project, takes the project's place.
    if (hero && p.pictures.concat(p.cover || []).some((im) => im.src === hero.src)) {
      addHome({ ...hero }, p, coverCaption);
    }
    addHome(p.thumb, p, coverCaption);
    for (const im of p.pictures.filter((x) => x.onHome)) {
      addHome(im, p, pictureCaption(im));
    }
  }
  if (hero && !seen.has(hero.src)) homeGallery.unshift({ image: hero, project: null, caption: null });
  else if (hero) {
    // Put the opening image first.
    const i = homeGallery.findIndex((x) => x.image.src === hero.src);
    if (i > 0) homeGallery.unshift(homeGallery.splice(i, 1)[0]);
  }

  // ---- Shop: real products only, entered in the admin. A product needs at
  // least one photo to be shown. No online payment: the button opens the
  // product's buy link, or an order email to the Contact page address.
  const shopCategories = (raw.shop.categories || [])
    .filter((c) => c && safeSlug(c.slug || ""))
    .map((c) => ({ slug: c.slug, name: pick(c, "name", lang) || c.slug }));
  const shopCat = new Map(shopCategories.map((c) => [c.slug, c]));
  const projectBySlug = new Map(projects.map((p) => [p.slug, p]));
  const products = raw.products
    .filter((x) => visible(x) && safeSlug(x.slug))
    .sort(byOrder)
    .map((x) => {
      const name = lang === "he" ? String(x.title_he || "").trim() || String(x.title_en || "").trim() : String(x.title_en || "").trim() || String(x.title_he || "").trim();
      const title = name || x.slug;
      const where = `product "${x.slug}"`;
      const pics = (x.images || []).map((g, j) => picture(g, title, `${where} photo ${j + 1}`)).filter(Boolean);
      const price = typeof x.price === "number" && isFinite(x.price) && x.price >= 0 ? x.price : null;
      const currency = ["ILS", "USD", "EUR"].includes(x.currency) ? x.currency : "ILS";
      return {
        slug: x.slug,
        title,
        description: pick(x, "description", lang),
        category: shopCat.get(x.category) || null,
        type: ["physical", "digital", "personalized", "made-to-order"].includes(x.type) ? x.type : "physical",
        availability: ["available", "preorder", "soon", "soldout"].includes(x.availability) ? x.availability : "available",
        price,
        priceText: price === null ? "" : new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(price) ? 0 : 2 }).format(price),
        priceFrom: x.price_from === true,
        variants: (x.variants || [])
          .map((v) => ({ name: pick(v, "name", lang), values: pick(v, "values", lang).split(",").map((t) => t.trim()).filter(Boolean) }))
          .filter((v) => v.name && v.values.length),
        projects: (Array.isArray(x.projects) ? x.projects : []).map((sl) => projectBySlug.get(sl)).filter(Boolean),
        buyUrl: /^https:\/\//.test(String(x.buy_url || "")) ? x.buy_url : "",
        images: pics,
        thumb: pics[0] || null,
        seoTitle: pick(x, "seo_title", lang),
        seoDescription: pick(x, "seo_description", lang),
      };
    })
    .filter((x) => {
      if (!x.thumb) images.warnings.push(`product "${x.slug}" is not shown yet: it has no photo`);
      return !!x.thumb;
    });
  for (const p of projects) p.products = products.filter((x) => x.projects.some((q) => q.slug === p.slug));

  return {
    hero,
    homeGallery,
    products,
    shop: { intro: pick(raw.shop, "intro", lang), categories: shopCategories.filter((c) => products.some((x) => x.category && x.category.slug === c.slug)) },
    participation,
    tagline: pick(s, "tagline", lang),
    showreel: parseVideo(s.showreel_url),
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
          name: lang === "he" ? String(m.name_he || "").trim() || m.name : m.name,
          role: pick(m, "role", lang),
          bio: pick(m, "bio", lang),
          photo: imgWithAlt(m.photo, m.name, `team member ${i + 1}`),
        })),
    },
    // A testimonial is shown only when it is visible AND the client's
    // permission to publish it has been confirmed in the admin panel.
    testimonials: raw.testimonials
      .filter((q) => visible(q) && q.consent_confirmed === true)
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
  add("shop/", render.shop(contextFor(lang, "shop/", data)));
  data.products.forEach((x) => {
    const pagePath = `shop/${x.slug}/`;
    add(pagePath, render.product(contextFor(lang, pagePath, data), x));
  });
  // Pages for visitor participation exist only while it is switched on.
  if (participation.ideas) add("ideas/", render.ideas(contextFor(lang, "ideas/", data)));
  if (participation.any) add("privacy/", render.privacy(contextFor(lang, "privacy/", data)));
  data.pages.forEach((p) => {
    const pagePath = `pages/${p.slug}/`;
    add(pagePath, render.customPage(contextFor(lang, pagePath, data), p));
  });
}

outputs.set("404.html", render.notFound(site, t.en, t.he, preview));

// Galleries keep every picture whole (never cropped). Each row is filled by
// giving each picture a share of the width that matches its proportions;
// those shares are written here as small CSS classes (no inline styles,
// which the Content-Security-Policy does not allow).
outputs.set(
  "css/gallery.css",
  "/* Generated by build.js: picture proportions for the galleries. */\n" +
    [...render.usedRatios]
      .sort((a, b) => a - b)
      .map((r) => `.ar-${r}{flex-grow:${r};flex-basis:calc(var(--row-h) * ${r / 100})}.ar-${r} .jg-media{aspect-ratio:${r / 100}}`)
      .join("\n") +
    "\n"
);

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

  // Pages this script wrote before but no longer produces (a project hidden
  // or still without images, a feature switched off) are never deleted:
  // they are replaced by the short bilingual "page not found" notice, which
  // search engines are told not to index. They come back when re-enabled.
  let retired = 0;
  for (const rel of previous) {
    if (outputs.has(rel) || !/^(he\/)?((work|services|about|testimonials|contact|ideas|privacy|shop|pages)\/.*)?index\.html$/.test(rel)) continue;
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, render.notFound(site, t.en, t.he, preview));
    outputs.set(rel, null); // keep it in the list
    retired++;
  }
  fs.writeFileSync(manifestFile, JSON.stringify([...outputs.keys()].sort(), null, 2) + "\n");

  console.log(
    `Built ${outputs.size} files (${[...outputs.keys()].filter((k) => k.endsWith("index.html")).length} pages)` +
      `${preview ? ", preview links" : ""}${retired ? `, ${retired} inactive pages show a "not found" notice` : ""}` +
      `${images.hasSharp ? `, ${made} new resized images` : ", no resized images (sharp not installed)"}`
  );
  for (const w of [...new Set(images.warnings)]) console.warn("Warning:", w);
})();

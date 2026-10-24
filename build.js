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
const crypto = require("crypto");
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
// Where the owner's page editor reads and saves content: the same GitHub
// repository and branch as the admin panel (admin/config.yml, "backend").
{
  const cfg = fs.readFileSync(path.join(__dirname, "admin", "config.yml"), "utf8");
  const backend = (cfg.split(/\n(?=\S)/).find((b) => /^backend:/.test(b)) || "");
  site.repo = (backend.match(/^\s+repo:\s*([\w.-]+\/[\w.-]+)/m) || [])[1] || "";
  site.branch = (backend.match(/^\s+branch:\s*([\w./-]+)/m) || [])[1] || "";
}
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
  styles: readJsonOr("content/styles.json", {}),
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
    for (const [field, places] of require("./src/labels-map")) {
      for (const [section, key] of places) {
        if (!t[lang][section] || typeof t[lang][section][key] !== "string") throw new Error(`labels-map: ${section}.${key} is not an interface label`);
        set(lang, t[lang][section], key, field);
      }
    }
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
// A title and short text the owner wrote for one picture (page editor, "Title and text"):
// <pre>title_<lang>, <pre>note_<lang>, and where to show them (<pre>caption). null when
// nothing is written or it is not shown anywhere.
const captionOf = (obj, pre, lang, shown) => {
  const where = String(obj[`${pre}caption`] || "hidden");
  if (!shown.includes(where)) return null;
  const title = pick(obj, `${pre}title`, lang), note = pick(obj, `${pre}note`, lang);
  return title || note ? { title, note, where } : null;
};
const pick = (obj, key, lang) => {
  const own = String(obj[`${key}_${lang}`] || "").trim();
  const other = String(obj[`${key}_${lang === "he" ? "en" : "he"}`] || "").trim();
  return own || other;
};

// Prices: any three-letter currency code the browser knows (ILS, USD, EUR…).
const money = {
  code(value, fallback) {
    const c = String(value || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return fallback;
    try { new Intl.NumberFormat("en", { style: "currency", currency: c }); return c; } catch (e) { return fallback; }
  },
  format(amount, currency, lang) {
    return new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  },
};

// ---- Currencies: the visitor may view prices in another currency. Those
// prices are APPROXIMATE (converted with the exchange rates of data/rates.json,
// updated by the build workflow, or with the manual rates set in the admin).
// Orders and payments always use the price's own currency.
function currencySettings(shop) {
  const fetched = readJsonOr("data/rates.json", null);
  const perUsd = {};
  let date = "", source = "";
  if (fetched && fetched.base === "USD" && fetched.rates) {
    for (const [c, v] of Object.entries(fetched.rates)) if (/^[A-Z]{3}$/.test(c) && typeof v === "number" && v > 0) perUsd[c] = v;
    date = /^\d{4}-\d{2}-\d{2}$/.test(fetched.date || "") ? fetched.date : "";
    source = String(fetched.source || "");
  }
  // Manual rates from the admin fill in currencies the download does not have.
  for (const r of Array.isArray(shop.manual_rates) ? shop.manual_rates : []) {
    const c = money.code(r && r.code, "");
    if (c && !perUsd[c] && typeof r.per_usd === "number" && r.per_usd > 0) perUsd[c] = r.per_usd;
  }
  perUsd.USD = 1;
  const wanted = Array.isArray(shop.currencies) && shop.currencies.length ? shop.currencies : ["ILS", "USD", "EUR"];
  const codes = [...new Set(wanted.map((c) => money.code(c, "")).filter((c) => c && perUsd[c]))];
  const rates = {};
  for (const c of Object.keys(perUsd)) rates[c] = perUsd[c];
  return { codes: codes.length > 1 ? codes : [], rates, date, source };
}

// ---- Shipping costs and VAT, shown in the product's price box and in the
// order summary. Only what is set in the admin is shown; in the preview's
// example mode, example values (marked as examples) fill the empty ones.
function shopCosts(shop, exampleMode, lang) {
  const num = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);
  const ship = (amount, currency, fallback) => {
    const a = num(amount);
    if (a !== null) return { amount: a, currency: money.code(currency, fallback.currency), text: money.format(a, money.code(currency, fallback.currency), lang), example: false };
    if (!exampleMode) return null;
    return { ...fallback, text: money.format(fallback.amount, fallback.currency, lang), example: true };
  };
  // Israeli law (Consumer Protection Law, section 17D) requires prices shown
  // to consumers to include VAT, so "VAT is added" is not offered.
  if (shop.vat === "added") console.warn('Warning: shop VAT "added" is ignored: consumer prices in Israel must include VAT (Consumer Protection Law, section 17D). Choose "Prices include VAT".');
  const vatMode = ["included", "none"].includes(shop.vat) ? shop.vat : exampleMode ? "included" : "";
  const vatRate = num(shop.vat_rate) !== null ? num(shop.vat_rate) : 18;
  return {
    shipIsrael: ship(shop.shipping_israel_price, shop.shipping_israel_currency, { amount: 25, currency: "ILS" }),
    // Free shipping in Israel from this order amount (same currency as the shipping price).
    freeIsraelFrom: num(shop.free_shipping_israel_from),
    shipAbroad: ship(shop.shipping_abroad_price, shop.shipping_abroad_currency, { amount: 15, currency: "USD" }),
    vat: vatMode ? { mode: vatMode, rate: vatRate, example: !["included", "none"].includes(shop.vat) } : null,
  };
}

// Example products for the preview (see exampleMode). Original BubaPix images.
const EXAMPLE_PRODUCTS = [
  {
    slug: "example-poster-print", card_fit: "fill", order: 1, category: "art-prints", type: "physical", availability: "available",
    title_en: "Example: THE NEW OCEAN poster print", title_he: "דוגמה: הדפס פוסטר THE NEW OCEAN",
    description_en: "An example product, shown only in the preview. Price and details are examples. It disappears automatically when you add a real product in the admin.",
    description_he: "מוצר לדוגמה, מוצג רק בתצוגה המקדימה. המחיר והפרטים לדוגמה. הוא נעלם אוטומטית כשמוסיפים מוצר אמיתי בניהול.",
    price: 120, currency: "ILS", price_abroad: 40, currency_abroad: "USD", ships_to: "worldwide",
    variants: [{ name_en: "Size", name_he: "מידה", values_en: "A3, A2", values_he: "A3, A2" }],
    projects: ["the-new-ocean"],
    details: [
      { title_en: "Paper and print (example)", title_he: "נייר והדפסה (דוגמה)", text_en: "Example text: paper type, print method and finish.", text_he: "טקסט לדוגמה: סוג הנייר, שיטת ההדפסה והגימור." },
      { title_en: "Size (example)", title_he: "מידות (דוגמה)", text_en: "Example text: A3 29.7 × 42 cm, A2 42 × 59.4 cm.", text_he: "טקסט לדוגמה: A3 ‏29.7 × 42 ס״מ, A2 ‏42 × 59.4 ס״מ." },
    ],
    images: [{ image: "/assets/work/the-new-ocean-poster.jpg" }, { image: "/assets/work/the-new-ocean-poster-boat.jpg" }, { image: "/assets/work/turtle-island.png" }],
  },
  {
    slug: "example-plush", card_fit: "fill", order: 2, category: "dolls", type: "physical", availability: "preorder",
    title_en: "Example: fluffy character plush", title_he: "דוגמה: בובה פרוותית",
    description_en: "An example product, shown only in the preview. Price and details are examples.",
    description_he: "מוצר לדוגמה, מוצג רק בתצוגה המקדימה. המחיר והפרטים לדוגמה.",
    price: 150, currency: "ILS", ships_to: "israel",
    images: [{ image: "/assets/work/white-fluffy-turnaround.png" }, { image: "/assets/work/white-creature.jpg" }, { image: "/assets/work/winged-white-creature.png" }],
  },
  {
    slug: "example-digital-poster", card_fit: "fill", order: 3, category: "posters", type: "digital", availability: "available",
    title_en: "Example: character line-up, digital file", title_he: "דוגמה: פוסטר דמויות, קובץ דיגיטלי",
    description_en: "An example product, shown only in the preview. Price and details are examples.",
    description_he: "מוצר לדוגמה, מוצג רק בתצוגה המקדימה. המחיר והפרטים לדוגמה.",
    price: 12, currency: "USD", ships_to: "digital",
    images: [{ image: "/assets/work/character-lineup.png" }, { image: "/assets/work/furry-characters-lineup.png" }],
  },
];

// ---- Payment methods: prepared, but each one is OFF until it is switched on
// in the admin with real account details. Nothing is charged by the site
// itself: a method opens the provider's own secure payment page.
function paymentMethods(shop, lang) {
  return (Array.isArray(shop.payment_methods) ? shop.payment_methods : [])
    .filter((m) => m && m.enabled === true)
    .map((m) => {
      const kind = ["paypal", "link"].includes(m.kind) ? m.kind : "link";
      const label = pick(m, "label", lang) || (kind === "paypal" ? "PayPal" : "");
      const note = pick(m, "note", lang);
      if (kind === "paypal") {
        const handle = String(m.paypal_me || "").trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/\/.*$/, "");
        return /^[A-Za-z0-9]{1,40}$/.test(handle) ? { kind, label, note, handle } : null;
      }
      const url = String(m.url || "").trim();
      return /^https:\/\/[^\s"<>]+$/.test(url) && label ? { kind, label, note, url } : null;
    })
    .filter(Boolean);
}

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
    .map((c) => {
      const name = pick(c, "name", lang) || c.slug;
      return {
        slug: c.slug,
        name,
        image: c.image ? picture({ image: c.image, alt_en: c.name_en, alt_he: c.name_he }, name, `shop category "${c.slug}" image`) : null,
        // Shown in the shop even before it has products ("coming soon").
        showEmpty: c.show_when_empty === true,
      };
    });
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
    // Frame: "natural" keeps the picture's own shape (whole, never cropped).
    // Other frames fill a fixed shape; "focus" says which part stays in view.
    im.frame = ["landscape", "square", "portrait", "wide"].includes(o.frame) ? o.frame : "natural";
    im.focus = ["top", "bottom", "left", "right"].includes(o.focus) ? o.focus : "center";
    // Optional link: clicking the picture opens it. A full https:// address,
    // or a page of this site written like /shop/ or /work/the-new-ocean/.
    const ln = String(o.link || "").trim();
    im.link = /^https:\/\/[^\s"<>]+$/.test(ln) ? { href: ln, external: true } : /^\/[a-z0-9\-\/]*$/.test(ln) ? { path: ln.replace(/^\//, ""), external: false } : null;
    // Homepage gallery size: auto follows the layout's rhythm.
    im.size = ["large", "medium", "small"].includes(o.size) ? o.size : "auto";
    // Free size on computers: width in % of the page, set by dragging in the
    // page editor (empty = the automatic layout).
    const fw = Number(o.fw);
    im.fw = Number.isFinite(fw) && fw >= 10 ? Math.min(100, Math.round(fw)) : 0;
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
        // Upright videos (phone format, YouTube Shorts) get an upright frame.
        const tall = typeof v === "string" ? /youtube\.com\/shorts\//.test(url) : v.shape === "tall" || (!v.shape && /youtube\.com\/shorts\//.test(url || ""));
        return { embed: parsed, file: local, title: typeof v === "string" ? "" : pick(v, "title", lang), tall };
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
          // A picture hidden in the page editor (visible: false) is kept in the file but not shown.
          const pics = (sec.images || []).map((g, j) => (g && g.visible === false ? null : picture(g, title, `${at} image ${j + 1}`))).filter(Boolean);
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
        // "Title and text" of the cover: under it on the projects page ("work"), on the project page ("project"), or both.
        coverCaption: captionOf(p, "cover_", lang, ["work", "project", "both"]),
        text: pick(p, "text", lang),
        description: pick(p, "description", lang),
        seoTitle: pick(p, "seo_title", lang),
        seoDescription: pick(p, "seo_description", lang),
        featured: p.featured !== false,
        // Shown in the homepage posters row (the owner can hide it there).
        inPosters: p.in_posters !== false,
        comments: p.comments !== false,
        categories: (Array.isArray(p.categories) ? p.categories : []).map((c) => catBySlug.get(c)).filter(Boolean),
        cover,
        // Width of the cover on computers (% of the page), set by dragging in the page editor.
        // Width of its picture on the projects page (computers), set in the page editor.
        // Width of its poster on the homepage (computers), set in the page editor.
        posterW: Number(p.poster_w) >= 10 && Number(p.poster_w) <= 100 ? Math.round(Number(p.poster_w)) : 0,
        listW: Number(p.list_w) >= 10 && Number(p.list_w) <= 100 ? Math.round(Number(p.list_w)) : 0,
        coverW: Number(p.cover_w) >= 20 && Number(p.cover_w) < 100 ? Math.round(Number(p.cover_w)) : 0,
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
  // Optional second opening picture, shown framed under the opening image
  // (Homepage > "Second opening picture"). It is not repeated in the gallery.
  const feature = (() => {
    const im = imgWithAlt(s.feature_image, pick(s, "feature_alt", lang), "second opening picture");
    if (!im) return null;
    const slug = s.feature_project || "";
    const project = slug ? projects.find((p) => p.slug === slug) || null : null;
    if (slug && !project) images.warnings.push(`second opening picture: project "${slug}" is not shown, so the picture has no link`);
    seen.add(im.src);
    return { image: im, project, caption: captionOf(s, "feature_", lang, ["everywhere"]) };
  })();
  const pictureCaption = (im) => (im.caption === "everywhere" && (im.title || im.note) ? { title: im.title, note: im.note } : null);
  // Homepage projects row: one poster per project, shown from two projects
  // up. Those posters are not repeated in the gallery (the opening image
  // keeps its place at the top).
  const posterList = projects.filter((p) => p.thumb && p.inPosters);
  const posters = posterList.length >= 2 ? posterList : [];
  for (const p of posters) if (!hero || p.thumb.src !== hero.src) seen.add(p.thumb.src);
  // Homepage gallery chosen in the admin (Homepage > Homepage gallery). A
  // picture opens its project's page when a project is chosen for it in the
  // admin; otherwise it is for looking only. When the list is empty, the
  // chosen projects' pictures are used instead.
  const projectsBySlug = new Map(projects.map((p) => [p.slug, p]));
  for (const [i, g] of (Array.isArray(s.gallery) ? s.gallery : []).entries()) {
    if (!g || g.visible === false) continue;
    const im = picture(g, "BubaPix", `homepage gallery image ${i + 1}`);
    const linked = g.project ? projectsBySlug.get(g.project) || null : null;
    if (g.project && !linked) images.warnings.push(`homepage gallery image ${i + 1}: project "${g.project}" is not shown, so the picture has no link`);
    if (im) addHome(im, linked, pictureCaption(im));
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
  if (hero && !seen.has(hero.src)) homeGallery.unshift({ image: hero, project: null, caption: captionOf(s, "hero_", lang, ["everywhere"]) });
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
    .map((c) => {
      const name = pick(c, "name", lang) || c.slug;
      return {
        slug: c.slug,
        name,
        image: c.image ? picture({ image: c.image, alt_en: c.name_en, alt_he: c.name_he }, name, `shop category "${c.slug}" image`) : null,
        // Shown in the shop even before it has products ("coming soon").
        showEmpty: c.show_when_empty === true,
        parentSlug: safeSlug(c.parent || "") && c.parent !== c.slug ? c.parent : "",
      };
    });
  const shopCat = new Map(shopCategories.map((c) => [c.slug, c]));
  // Subcategories: one level only. A category whose main category is missing,
  // or is itself a subcategory, is shown as a main category.
  for (const c of shopCategories) {
    const main = shopCat.get(c.parentSlug);
    c.parent = main && !main.parentSlug ? main.slug : "";
    if (c.parentSlug && !c.parent) console.warn(`Warning: shop category "${c.slug}": main category "${c.parentSlug}" not found or is itself a subcategory; shown as a main category`);
  }
  const projectBySlug = new Map(projects.map((p) => [p.slug, p]));
  // Preview only: while the shop has no real products, three clearly marked
  // EXAMPLE products show how the shop looks and works. They are never built
  // on the live site (main) and disappear as soon as a real product exists.
  const exampleMode = preview && !raw.products.some((x) => visible(x) && safeSlug(x.slug));
  const products = (exampleMode ? EXAMPLE_PRODUCTS : raw.products)
    .filter((x) => visible(x) && safeSlug(x.slug) && x.slug !== "order") // "order" is the order page
    .sort(byOrder)
    .map((x) => {
      const name = lang === "he" ? String(x.title_he || "").trim() || String(x.title_en || "").trim() : String(x.title_en || "").trim() || String(x.title_he || "").trim();
      const title = name || x.slug;
      const where = `product "${x.slug}"`;
      // Each picture without its own description still gets a distinct one ("name — photo N"), for screen readers.
      const nPics = (x.images || []).length;
      const pics = (x.images || []).map((g, j) => picture(g, nPics > 1 ? `${title} — ${t[lang].shop.photo.replace("{n}", j + 1)}` : title, `${where} photo ${j + 1}`)).filter(Boolean);
      const price = typeof x.price === "number" && isFinite(x.price) && x.price >= 0 ? x.price : null;
      const currency = money.code(x.currency, "ILS");
      const priceAbroad = typeof x.price_abroad === "number" && isFinite(x.price_abroad) && x.price_abroad >= 0 ? x.price_abroad : null;
      const currencyAbroad = money.code(x.currency_abroad, "USD");
      return {
        slug: x.slug,
        example: exampleMode,
        title,
        description: pick(x, "description", lang),
        category: shopCat.get(x.category) || null,
        type: ["physical", "digital", "personalized", "made-to-order"].includes(x.type) ? x.type : "physical",
        availability: ["available", "preorder", "soon", "soldout"].includes(x.availability) ? x.availability : "available",
        price,
        currency,
        priceText: price === null ? "" : money.format(price, currency, lang),
        priceAbroad,
        currencyAbroad,
        priceAbroadText: priceAbroad === null ? "" : money.format(priceAbroad, currencyAbroad, lang),
        shipsTo: ["israel", "worldwide", "digital"].includes(x.ships_to) ? x.ships_to : x.type === "digital" ? "digital" : "worldwide",
        priceFrom: x.price_from === true,
        variants: (x.variants || [])
          .map((v) => ({ name: pick(v, "name", lang), values: pick(v, "values", lang).split(",").map((t) => t.trim()).filter(Boolean) }))
          .filter((v) => v.name && v.values.length),
        projects: (Array.isArray(x.projects) ? x.projects : []).map((sl) => projectBySlug.get(sl)).filter(Boolean),
        buyUrl: /^https:\/\//.test(String(x.buy_url || "")) ? x.buy_url : "",
        images: pics,
        thumb: pics[0] || null,
        cardFit: x.card_fit === "fill" ? "fill" : "whole",
        cardFocus: ["top", "bottom", "left", "right"].includes(x.card_focus) ? x.card_focus : "center",
        seoTitle: pick(x, "seo_title", lang),
        seoDescription: pick(x, "seo_description", lang),
        // More details, opened by the visitor (materials, size, care…).
        details: (Array.isArray(x.details) ? x.details : [])
          .map((d) => ({ title: pick(d, "title", lang), text: pick(d, "text", lang) }))
          .filter((d) => d.title && d.text),
      };
    })
    .filter((x) => {
      if (!x.thumb) images.warnings.push(`product "${x.slug}" is not shown yet: it has no photo`);
      return !!x.thumb;
    });
  for (const p of projects) p.products = products.filter((x) => x.projects.some((q) => q.slug === p.slug));

  return {
    hero,
    feature,
    posters,
    homeGallery,
    products,
    shop: {
      shippingIsrael: pick(raw.shop, "shipping_israel", lang),
      shippingAbroad: pick(raw.shop, "shipping_abroad", lang),
      checkout: "email", // the order request is sent by email; payment methods are optional and off by default
      currency: currencySettings(raw.shop),
      ...shopCosts(raw.shop, exampleMode, lang),
      returns: pick(raw.shop, "returns", lang),
      example: exampleMode,
      payments: paymentMethods(raw.shop, lang),
      intro: pick(raw.shop, "intro", lang),
      // Category tiles: those with products, those marked "show before it has
      // products", and, in the preview's example mode, all of them (so the
      // empty places can be seen and filled).
      // A main category counts its subcategories' products too, and is shown
      // when any of its subcategories is shown.
      categories: (() => {
        const inCat = (x, slug) => x.category && (x.category.slug === slug || x.category.parent === slug);
        const shown = (c) => c.count > 0 || c.showEmpty || exampleMode;
        const all = shopCategories.map((c) => ({ ...c, count: products.filter((x) => inCat(x, c.slug)).length }));
        return all
          .filter((c) => shown(c) || (!c.parent && all.some((s) => s.parent === c.slug && shown(s))))
          .map((c) => ({ ...c, subs: c.parent ? [] : all.filter((s) => s.parent === c.slug && shown(s)) }));
      })() },
    participation,
    analytics: Boolean(site.analyticsHead),
    tagline: pick(s, "tagline", lang),
    showreel: parseVideo(s.showreel_url),
    // Homepage gallery layout chosen in the admin (Homepage > "Gallery
    // layout"). Unknown or empty values keep the usual mixed rhythm.
    galleryLayout: {
      columns: ["2", "3", "4"].includes(String(s.gallery_columns)) ? Number(s.gallery_columns) : 0,
      phone: ["1", "2"].includes(String(s.gallery_phone)) ? Number(s.gallery_phone) : 0,
      gap: ["none", "small", "medium"].includes(s.gallery_gap) ? s.gallery_gap : "",
      // Width of the second opening picture: small (the usual), medium, large or the full width.
      feature: ["medium", "large", "full"].includes(s.feature_size) ? s.feature_size : "",
      // Free widths of the two opening pictures, in % of the page (computers).
      heroW: Number(s.hero_w) >= 20 && Number(s.hero_w) < 100 ? Math.round(Number(s.hero_w)) : 0,
      featureW: Number(s.feature_w) >= 15 && Number(s.feature_w) <= 100 ? Math.round(Number(s.feature_w)) : 0,
    },
    intro: pick(s, "intro", lang),
    seoDescription: pick(s, "seo_description", lang) || pick(s, "intro", lang),
    categories,
    projects,
    services: {
      intro: pick(raw.services, "intro", lang),
      items: (raw.services.services || []).map((x, i) => ({ name: pick(x, "name", lang), text: pick(x, "text", lang), i })).filter((x) => x.name),
      processTitle: pick(raw.services, "process_title", lang),
      process: (raw.services.process || []).map((x, i) => ({ name: pick(x, "name", lang), text: pick(x, "text", lang), i })).filter((x) => x.name),
    },
    about: {
      body: pick(raw.about, "body", lang),
      // i = the member's place in content/about.json (the page editor uses it).
      team: (raw.about.team || [])
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m && m.name)
        .map(({ m, i }) => ({
          name: lang === "he" ? String(m.name_he || "").trim() || m.name : m.name,
          role: pick(m, "role", lang),
          bio: pick(m, "bio", lang),
          photo: imgWithAlt(m.photo, lang === "he" ? String(m.name_he || "").trim() || m.name : m.name, `team member ${i + 1}`),
          i,
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
      // Second (backup) address: shown next to the first; order emails go to both.
      email2: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw.contact.email_2 || "").trim()) ? raw.contact.email_2.trim() : "",
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

// Version tag on style and script addresses (css/styles.css?v=…): it changes
// whenever a file changes, so browsers and the installed app always load the
// current file instead of an old saved copy.
const fileVersion = (files) => crypto.createHash("sha256").update(files.map((f) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f)) : "")).join("|")).digest("hex").slice(0, 10);
const assetVersion = {
  styles: fileVersion(["css/styles.css"]),
  fonts: fileVersion(["css/fonts.css"]),
  main: fileVersion(["js/main.js"]),
  shop: fileVersion(["js/shop.js"]),
  community: fileVersion(["js/community.js"]),
  editor: fileVersion(["js/editor.js"]),
  projectEditor: fileVersion(["js/project-editor.js"]),
  workEditor: fileVersion(["js/work-editor.js"]),
  pageEditor: fileVersion(["js/page-editor.js"]),
  autoTranslate: fileVersion(["js/auto-translate.js"]),
  textStyle: fileVersion(["js/text-style.js"]),
  previewPublish: fileVersion(["js/preview-publish.js"]),
  history: fileVersion(["js/history.js"]),
  editorCore: fileVersion(["js/editor-core.js"]),
};

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
    v: assetVersion,
    data,
    share: images.share,
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
  outputs.set((lang === "he" ? "he/" : "") + "shop/order/index.html", render.order(contextFor(lang, "shop/order/", data)));
  // Owner's management page: not listed in the sitemap, not indexed.
  outputs.set((lang === "he" ? "he/" : "") + "manage/index.html", render.manage(contextFor(lang, "manage/", data)));
  data.products.forEach((x) => {
    const pagePath = `shop/${x.slug}/`;
    add(pagePath, render.product(contextFor(lang, pagePath, data), x));
  });
  // Pages for visitor participation exist only while it is switched on.
  if (participation.ideas) add("ideas/", render.ideas(contextFor(lang, "ideas/", data)));
  // Always built: the shop and browser storage are described there too.
  add("privacy/", render.privacy(contextFor(lang, "privacy/", data)));
  add("accessibility/", render.accessibility(contextFor(lang, "accessibility/", data)));
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
      .map((r) => `.ar-${r}{flex-grow:${r};flex-basis:calc(var(--row-h) * ${r / 100})}.ar-${r} .jg-media{aspect-ratio:${r / 100}}` +
        // A narrow picture alone in its row: centred, about one screen high at most.
        (r < 130 ? `\n.mrow.n1>.ar-${r}{flex:none!important;width:min(100%,calc(80vh * ${r / 100}));margin-inline:auto}` : ""))
      .join("\n") +
    "\n" +
    // Free sizes chosen in the page editor: computers only (phones keep the
    // automatic two-by-two layout).
    (render.freeRules.size ? `@media (min-width: 701px){\n${[...render.freeRules.values()].join("\n")}\n}\n` : "")
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

// ---- Installable app (PWA): "Add to home screen" opens the site full screen
// with the BubaPix icon. The icons are the unchanged logo on its own paper
// colour (assets/brand/icons). Relative addresses keep it working on any
// address the site is served from.
// One manifest per language, so the app opens in the language it was
// installed from (Hebrew pages link manifest.he.webmanifest).
for (const [file, lang, start, desc] of [
  ["manifest.webmanifest", "en", "./", "BubaPix — film and animation studio"],
  ["manifest.he.webmanifest", "he", "./he/", "BubaPix — סטודיו לסרטים ולאנימציה"],
]) outputs.set(
  file,
  JSON.stringify(
    {
      id: start,
      name: "BubaPix",
      short_name: "BubaPix",
      description: desc,
      lang,
      dir: lang === "he" ? "rtl" : "ltr",
      start_url: start,
      scope: "./",
      display: "standalone",
      background_color: "#f7f6ef",
      theme_color: "#f7f6ef",
      icons: [
        { src: "assets/brand/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "assets/brand/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "assets/brand/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "assets/brand/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2
  ) + "\n"
);
// gallery.css is written after the pages, so its version is filled in now.
{
  const gv = crypto.createHash("sha256").update(outputs.get("css/gallery.css")).digest("hex").slice(0, 10);
  for (const [rel, html] of outputs) if (rel.endsWith(".html") && html.includes("__GALLERY_V__")) outputs.set(rel, html.split("__GALLERY_V__").join(gv));
}
// Text styles chosen by the owner (content/styles.json) become classes on
// the marked texts (data-ts) of every page.
{
  const { applyStyles } = require("./src/text-style.js");
  for (const [rel, html] of outputs) if (rel.endsWith(".html") && !rel.startsWith("admin/") && typeof html === "string") outputs.set(rel, applyStyles(html, raw.styles));
}
// The service worker. Pages always come from the network first (so changes
// show at once) and fall back to the saved copy when offline; styles,
// scripts and pictures are kept after the first visit. Its version changes
// whenever the styles or scripts change, which clears the old saved copies.
// The admin pages and other sites (fonts, comments) are never touched.
const swVersion = crypto
  .createHash("sha256")
  .update(["css/styles.css", "js/main.js", "js/shop.js", "js/community.js"].map((f) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f)) : "")).join("|") + outputs.get("css/gallery.css"))
  .digest("hex")
  .slice(0, 12);
outputs.set(
  "sw.js",
  `// BubaPix: helper that lets the installed site open fast and work offline.
"use strict";
const CACHE = "bubapix-${swVersion}";
const HOME = new URL("./", self.location).href;
// Shown when there is no connection and the page was never saved. A page is
// never shown at another page's address (its links would break).
const OFFLINE = \`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BubaPix</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f6ef;color:#16161d;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:600;margin:0 0 8px">אין חיבור לאינטרנט</p><p style="margin:0 0 20px" lang="en" dir="ltr">You are offline</p>
<a href="\${HOME}" style="color:#16161d">BubaPix</a></div></body></html>\`;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bubapix-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/admin/")) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })))
    );
    return;
  }
  if (!/\\.(css|js|webp|jpe?g|png|svg|woff2|webmanifest)$/.test(url.pathname)) return;
  const save = (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy).then(() => trim(c))); }
    return res;
  };
  // Files with a version in the address (?v=…) never change: saved copy first.
  // Files without one (pictures, the logo, the app manifest) can be replaced
  // at the same address: show the saved copy at once, and refresh it in the
  // background so the next visit has the new one.
  if (url.search) { e.respondWith(caches.match(req).then((m) => m || fetch(req).then(save))); return; }
  e.respondWith(caches.match(req).then((m) => {
    const fresh = fetch(req).then(save).catch(() => m || Response.error());
    if (m) { e.waitUntil(fresh); return m; }
    return fresh;
  }));
});
// Keep the saved copies small: at most MAX files, the oldest go first.
const MAX = 150;
function trim(c) {
  return c.keys().then((keys) => {
    const extra = keys.filter((k) => k.mode !== "navigate" && !/\\.html$|\\/$/.test(new URL(k.url).pathname)).slice(0, Math.max(0, keys.length - MAX));
    return Promise.all(extra.map((k) => c.delete(k)));
  });
}
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
    if (outputs.has(rel) || !/^(he\/)?((work|services|about|testimonials|contact|ideas|privacy|accessibility|shop|pages)\/.*)?index\.html$/.test(rel)) continue;
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

// Page renderers for the BubaPix site (redesign v2, multi-page).
// build.js calls these once per page and language. Visible interface labels
// come from src/i18n/<lang>.json; everything else comes from content/*.

const crypto = require("crypto");
const md = require("./markdown.js");
const { icon, networkOf } = require("./icons.js");

function e(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

// Relative link from the current page to another page of the same language.
// "preview" mode writes ".../index.html" so links also work on preview hosts
// that don't open folder addresses; the live site uses clean addresses.
function makeLink(ctx) {
  return (path, hash = "") => {
    const file = ctx.preview ? "index.html" : "";
    const href = ctx.base + path + file;
    return (href || "./") + hash;
  };
}

function img(ctx, im, { sizes = "100vw", attrs = 'loading="lazy" decoding="async"', cls = "" } = {}) {
  const srcset = im.srcset
    ? ` srcset="${im.srcset.split(", ").map((p) => ctx.assetBase + e(p)).join(", ")}" sizes="${sizes}"`
    : "";
  return `<img${cls ? ` class="${cls}"` : ""} src="${ctx.assetBase}${e(im.src)}"${srcset} alt="${e(im.alt)}"${im.w ? ` width="${im.w}" height="${im.h}"` : ""} ${attrs}>`;
}

function logo(ctx, alt, cls, attrs = "") {
  // Original logo file. .logo-frame hides the thin dark screenshot strips on
  // its top and bottom edges with CSS; the file itself is untouched.
  return `<span class="logo-frame ${cls}"><img src="${ctx.assetBase}assets/brand/bubapix-logo.jpg" alt="${e(alt)}" width="989" height="902" ${attrs}></span>`;
}

// ---------------------------------------------------------------------------
// Galleries: pictures are shown whole (never cropped). Rows are "justified":
// each picture's width share matches its proportions, so every row lines up.
// The proportions become small CSS classes in css/gallery.css (see build.js).
// ---------------------------------------------------------------------------
const usedRatios = new Set();
// Free sizes from the page editor: class name -> CSS rule (no inline styles,
// which the Content-Security-Policy does not allow).
const freeRules = new Map();
const FRAMES = { wide: 240, landscape: 178, square: 100, portrait: 80 };
function ratioClass(im) {
  const fixed = FRAMES[im.frame];
  const r = fixed || (im.w && im.h ? Math.round((im.w / im.h) * 100) : 150);
  const clamped = Math.min(400, Math.max(40, r));
  usedRatios.add(clamped);
  return { cls: `ar-${clamped}`, ratio: clamped / 100 };
}

// One gallery picture. href: where it leads (project page or full image).
// caption: { title, note } or null. lead: shown alone, full width.
// Address for a picture's own link (see build.js picture()).
const linkOf = (ctx, ln) => (ln.external ? e(ln.href) : makeLink(ctx)(ln.path));

function galleryItem(ctx, im, { href = "", label = "", caption = null, lead = false, eager = false, viewer = false, external = false, sizes, extraClass = "" } = {}) {
  const { cls, ratio } = ratioClass(im);
  const isLead = lead && ratio >= 1.2;
  const sz = sizes || (isLead ? "(max-width: 1440px) 100vw, 1440px" : "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 40vw");
  const picture = `<span class="jg-media">${img(ctx, im, { sizes: sz, attrs: eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"' })}</span>`;
  const capInner = caption && (caption.title || caption.note)
    ? `${caption.title ? `<span class="jg-title">${e(caption.title)}</span>` : ""}${caption.note ? `<span class="jg-note">${e(caption.note)}</span>` : ""}`
    : "";
  const framed = FRAMES[im.frame] ? ` fit-cover focus-${im.focus || "center"}` : "";
  const classes = `jg-item ${cls}${isLead ? " is-lead" : ""}${framed}${extraClass ? " " + extraClass : ""}`;
  if (!href) {
    return `<figure class="${classes}">${picture}${capInner ? `<figcaption class="jg-caption">${capInner}</figcaption>` : ""}</figure>`;
  }
  return `<a class="${classes}" href="${href}"${label ? ` aria-label="${e(label)}"` : ""}${viewer ? " data-viewer" : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${picture}${capInner ? `<span class="jg-caption">${capInner}</span>` : ""}</a>`;
}

function gallery(items, extraClass = "") {
  return `<div class="jg${extraClass ? " " + extraClass : ""}">
        ${items.join("\n        ")}
      </div>`;
}


// Content-Security-Policy: the browser runs only our own scripts (plus the
// two small inline ones, allowed by their exact fingerprint) and talks only to
// the services listed here. This limits the damage if malicious text ever
// slipped through.
function csp(ctx, inlineScripts, pageEditor = false) {
  const hashes = inlineScripts.map((code) => `'sha256-${crypto.createHash("sha256").update(code).digest("base64")}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`,
    "style-src 'self'",
    "font-src 'self'",
    // Preview builds are viewed on raw.githack.com, which serves pages
    // itself but REDIRECTS images and videos to raw.githubusercontent.com.
    // Only preview builds allow that address; the live site stays 'self'.
    // Pages with the owner's "Edit on the page" also show pictures chosen on
    // this computer before they are saved (blob:).
    `img-src 'self' data:${pageEditor ? " blob:" : ""}${ctx.preview ? " https://raw.githubusercontent.com" : ""}`,
    `media-src 'self'${ctx.preview ? " https://raw.githubusercontent.com" : ""}`,
    // The owner's page editor reads and saves the page settings in the
    // GitHub repository, with the owner's own sign-in.
    `connect-src ${[ctx.site.community ? ctx.site.community.url : "", pageEditor ? "'self' https://api.github.com https://api.mymemory.translated.net" : ""].filter(Boolean).join(" ") || "'none'"}`,
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

// Settings and labels for js/community.js. Stored as JSON (not run as code).
function communityData(ctx) {
  const { t, site, lang } = ctx;
  const c = site.community;
  const json = JSON.stringify({
    url: c.url,
    key: c.anonKey,
    lang,
    t: { ...t.community, ideaSent: t.ideas.sent, consultSent: t.consult.sent },
  }).replace(/</g, "\\u003c");
  return `<script type="application/json" id="community-data">${json}</script>`;
}

// Labels and settings for js/shop.js (stored as JSON, not run as code).
function shopData(ctx) {
  const { t, lang, data } = ctx;
  const json = JSON.stringify({
    lang,
    emails: [data.contact.email, data.contact.email2].filter(Boolean),
    orderUrl: makeLink(ctx)("shop/order/"),
    currency: data.shop.currency,
    payments: data.shop.payments,
    shipIsrael: data.shop.shipIsrael,
    freeIsraelFrom: data.shop.freeIsraelFrom,
    shipAbroad: data.shop.shipAbroad,
    vat: data.shop.vat,
    t: t.shop,
  }).replace(/</g, "\\u003c");
  return `<script type="application/json" id="shop-data">${json}</script>`;
}

function layout(ctx, { title, description, image, main, current = "", community = false, viewer = false, shopScript = false, noindex = false, edits = [], pageEditor = false }) {
  const { t, lang, dir, site, data } = ctx;
  const link = makeLink(ctx);
  const otherHref = ctx.otherBase + ctx.path + (ctx.preview ? "index.html" : "") + (lang === "he" ? "?lang=en" : "");
  const otherLang = lang === "he" ? "en" : "he";
  const absUrl = (l) => site.url + (l === "he" ? "he/" : "") + ctx.path;
  const firstHome = data.homeGallery[0] && data.homeGallery[0].image;
  const ogImage = image ? site.url + image.src : data.hero ? site.url + data.hero.src : firstHome ? site.url + firstHome.src : site.url + "assets/brand/bubapix-logo.jpg";

  const nav = [
    ["work/", t.nav.work, "work"],
    ["services/", t.nav.services, "services"],
    ["shop/", t.nav.shop, "shop"],
    ["about/", t.nav.about, "about"],
    ...(data.testimonials.length ? [["testimonials/", t.nav.testimonials, "testimonials"]] : []),
    ...data.pages.filter((p) => p.menu).map((p) => [`pages/${p.slug}/`, p.title, `page:${p.slug}`]),
    ["contact/", t.nav.contact, "contact"],
  ];
  const navItems = nav
    .map(([path, label, key]) => `<li><a href="${link(path)}"${key === current ? ' aria-current="page"' : ""}>${e(label)}</a></li>`)
    .join("\n        ");
  const footerPages = data.pages.filter((p) => !p.menu);

  // On English pages: send visitors who chose Hebrew before to the Hebrew page.
  const redirectCode =
    lang === "en"
      ? `try{if(localStorage.getItem("bubapix-lang")==="he"&&!/[?&]lang=en\\b/.test(location.search)){location.replace(${JSON.stringify(ctx.otherBase + ctx.path + (ctx.preview ? "index.html" : ""))}+location.hash)}}catch(e){}`
      : "";
  const redirect = redirectCode ? `<script>${redirectCode}</script>` : "";
  const jsFlag = `document.documentElement.classList.add("js");`;
  const withCommunity = community && site.community;
  const policy = site.analyticsHead
    ? ""
    : `\n  <meta http-equiv="Content-Security-Policy" content="${csp(ctx, [redirectCode, jsFlag].filter(Boolean), pageEditor)}">`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${policy}${noindex ? `
  <meta name="robots" content="noindex">` : ""}
  ${redirect}
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}">
  <link rel="canonical" href="${absUrl(lang)}">
  <link rel="alternate" hreflang="en" href="${absUrl("en")}">
  <link rel="alternate" hreflang="he" href="${absUrl("he")}">
  <link rel="alternate" hreflang="x-default" href="${absUrl("en")}">
  <meta name="theme-color" content="#f7f6ef">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BubaPix">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${absUrl(lang)}">
  <meta property="og:image" content="${e(ogImage)}">
  <meta property="og:locale" content="${t.meta.ogLocale}">
  <meta property="og:locale:alternate" content="${ctx.otherT.meta.ogLocale}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${ctx.assetBase}favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="${ctx.assetBase}manifest${lang === "he" ? ".he" : ""}.webmanifest">
  <link rel="apple-touch-icon" href="${ctx.assetBase}assets/brand/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-title" content="BubaPix">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <link rel="preload" href="${ctx.assetBase}assets/fonts/${lang === "he" ? "heebo-hebrew" : "heebo-latin"}-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${ctx.assetBase}css/fonts.css?v=${ctx.v.fonts}">
  <script>${jsFlag}</script>
  <link rel="stylesheet" href="${ctx.assetBase}css/styles.css?v=${ctx.v.styles}">
  <link rel="stylesheet" href="${ctx.assetBase}css/gallery.css?v=__GALLERY_V__">
  <script src="${ctx.assetBase}js/main.js?v=${ctx.v.main}" defer></script>${shopScript ? `
  ${shopData(ctx)}
  <script src="${ctx.assetBase}js/shop.js?v=${ctx.v.shop}" defer></script>` : ""}${withCommunity ? `
  ${communityData(ctx)}
  <script src="${ctx.assetBase}js/community.js?v=${ctx.v.community}" defer></script>` : ""}${site.analyticsHead ? `
  ${site.analyticsHead}` : ""}
</head>
<body${viewer ? ` data-viewer-labels="${e(JSON.stringify(t.viewer))}"` : ""}>
  <a class="skip-link" href="#main">${e(t.a11y.skip)}</a>

  <header class="site-header">
    <a class="brand" href="${link("")}" aria-label="${e(t.a11y.home)}">${logo(ctx, "", "logo-compact")}</a>
    <nav class="site-nav" aria-label="${e(t.a11y.mainNav)}">
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu" data-open="${e(t.a11y.menuOpen)}" data-close="${e(t.a11y.menuClose)}" hidden>${e(t.a11y.menuOpen)}</button>
      <ul class="menu" id="menu">
        ${navItems}
        <li><a class="lang-switch" href="${otherHref}" hreflang="${otherLang}" lang="${otherLang}" title="${e(t.nav.switchTitle)}" data-lang="${otherLang}">${e(t.nav.switchLabel)}</a></li>
      </ul>
    </nav>
  </header>

  <main id="main">
${main}
  </main>
${editBar(ctx, edits, pageEditor)}

  <footer class="site-footer">
    <nav class="footer-nav" aria-label="${e(t.a11y.footerNav)}">
      <ul>
        <li><a href="${link("")}">${e(t.nav.home)}</a></li>
        ${nav.map(([path, label]) => `<li><a href="${link(path)}">${e(label)}</a></li>`).join("\n        ")}${footerPages.map((p) => `
        <li><a href="${link(`pages/${p.slug}/`)}">${e(p.title)}</a></li>`).join("")}
${data.participation.ideas ? `
        <li><a href="${link("ideas/")}"${current === "ideas" ? ' aria-current="page"' : ""}>${e(t.nav.ideas)}</a></li>` : ""}
        <li><a href="${link("privacy/")}"${current === "privacy" ? ' aria-current="page"' : ""}>${e(t.nav.privacy)}</a></li>
        <li><a href="${link("accessibility/")}"${current === "accessibility" ? ' aria-current="page"' : ""}>${e(t.nav.accessibility)}</a></li>
      </ul>
    </nav>
    ${footerContact(ctx)}
    ${installButton(ctx)}
    <div class="footer-meta">
      <a class="lang-switch" href="${otherHref}" hreflang="${otherLang}" lang="${otherLang}" data-lang="${otherLang}">${e(t.nav.switchLabel)}</a>
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> BubaPix</p>
      <a href="#main">${e(t.footer.top)}</a>
    </div>
  </footer>
</body>
</html>
`;
}

// Social profiles as icons. The visible name is optional; the link always has
// an accessible name and opens the studio's own profile in a new tab.
function socialList(ctx, cls, named = false) {
  const { t, data } = ctx;
  if (!data.contact.social.length) return "";
  return `<ul class="${cls}" aria-label="${e(t.contact.social)}">${data.contact.social
    .map((x) => {
      const label = x.label || networkOf(x.url);
      return `<li><a href="${e(x.url)}" rel="noopener me" target="_blank"${named ? "" : ` aria-label="${e(label)}" title="${e(label)}"`}>${icon(networkOf(x.url))}${named ? `<span>${e(label)}</span>` : ""}</a></li>`;
    })
    .join("")}</ul>`;
}

// "Install the app": shown by js/main.js only where installing is possible
// (Android/Chrome: the browser's own install window; iPhone: short steps).
// Hidden when the site is already open as the installed app.
function installButton(ctx) {
  const { t } = ctx;
  return `<div class="install-wrap">
      <button type="button" class="install-button" data-install hidden>${icon("install")}<span>${e(t.app.install)}</span></button>
      <dialog class="install-help" data-install-help aria-labelledby="install-title">
        <h2 id="install-title">${e(t.app.iosTitle)}</h2>
        <ol>${t.app.iosSteps.map((x) => `<li>${e(x)}</li>`).join("")}</ol>
        <button type="button" class="button" data-install-close>${e(t.app.close)}</button>
      </dialog>
    </div>`;
}

// Footer contact band: the emails (clearly visible) and the social icons.
function footerContact(ctx) {
  const { t, data } = ctx;
  const mails = [data.contact.email, data.contact.email2].filter(Boolean);
  if (!mails.length && !data.contact.social.length) return "";
  return `<div class="footer-contact">${mails.length ? `
      <p class="footer-mails">${icon("email")}${mails.map((m) => `<a class="footer-email" href="mailto:${e(m)}">${e(m)}</a>`).join(`<span class="sep" aria-hidden="true">·</span>`)}</p>` : ""}
      ${socialList(ctx, "footer-social")}
    </div>`;
}

// ---- Editing ---------------------------------------------------------------
// Addresses inside the admin panel (Sveltia CMS opens the right screen).
const adminHref = (ctx, hash = "") => `${ctx.assetBase}admin/${ctx.preview ? "index.html" : ""}${hash}`;
const communityHref = (ctx) => `${ctx.assetBase}admin/community/${ctx.preview ? "index.html" : ""}`;
const ed = {
  site: "#/collections/settings/entries/site",
  services: "#/collections/settings/entries/services",
  about: "#/collections/settings/entries/about",
  contact: "#/collections/settings/entries/contact",
  shop: "#/collections/settings/entries/shop",
  labels: "#/collections/settings/entries/labels",
  newProject: "#/collections/projects/new",
  newProduct: "#/collections/products/new",
  project: (slug) => `#/collections/projects/entries/${encodeURIComponent(slug)}`,
  product: (slug) => `#/collections/products/entries/${encodeURIComponent(slug)}`,
  page: (slug) => `#/collections/pages/entries/${encodeURIComponent(slug)}`,
};

// The "Edit this page" bar. Hidden for everyone; js/main.js shows it only in
// a browser where the owner switched edit buttons on (Manage page). The links
// only open the admin panel, which asks for the owner's own sign-in.
function editBar(ctx, edits, pageEditor = false) {
  const { t } = ctx;
  // "Edit on the page": loads js/editor.js only when pressed (owner only).
  // Project pages have their own editor (js/project-editor.js).
  const src = pageEditor === "project" ? `js/project-editor.js?v=${ctx.v.projectEditor}` : pageEditor === "work" ? `js/work-editor.js?v=${ctx.v.workEditor}` : pageEditor === "page" ? `js/page-editor.js?v=${ctx.v.pageEditor}` : `js/editor.js?v=${ctx.v.editor}`;
  const onPage = pageEditor && ctx.site.repo
    ? `<button type="button" class="edit-bar-page" data-page-editor data-src="${ctx.assetBase}${src}" data-repo="${e(ctx.site.repo)}" data-branch="${e(ctx.site.branch)}" data-tr-src="${ctx.assetBase}js/auto-translate.js?v=${ctx.v.autoTranslate}" data-manage="${makeLink(ctx)("manage/")}">${icon("edit")}<span>${e(t.edit.onPage)}</span></button>`
    : "";
  const items = edits
    .map(([label, hash, community]) => `<li><a href="${e(community ? communityHref(ctx) : adminHref(ctx, hash))}" target="_blank" rel="noopener">${icon("edit")}<span>${e(label)}</span></a></li>`)
    .join("");
  return `  <aside class="edit-bar" data-edit-bar hidden aria-label="${e(t.edit.bar)}">
    <details>
      <summary class="edit-bar-title">${icon("edit")}${e(t.edit.bar)}</summary>${onPage}
      <ul>${items}<li><a href="${makeLink(ctx)("manage/")}">${e(t.edit.all)}</a></li></ul>
      <button type="button" class="edit-bar-off" data-edit-off>${e(t.edit.off)}</button>
    </details>
  </aside>`;
}

// Manage page: the owner's entry point to every editing tool.
function manage(ctx) {
  const { t, data } = ctx;
  const quick = [
    [t.edit.gallery, ed.site], [t.edit.newProject, ed.newProject], [t.edit.newProduct, ed.newProduct],
    [t.edit.shopSettings, ed.shop], [t.edit.services, ed.services], [t.edit.about, ed.about],
    [t.edit.contact, ed.contact], [t.edit.texts, ed.labels],
    ...data.projects.map((p) => [t.edit.project.replace("{name}", p.title), ed.project(p.slug)]),
  ];
  const steps = (list) => `<ol class="manage-steps">${list.map((x) => `<li>${e(x)}</li>`).join("")}</ol>`;
  return layout(ctx, {
    title: pageTitle(ctx, t.edit.manageTitle),
    description: t.edit.manageIntro,
    current: "manage",
    noindex: true,
    main: `
    <div class="page manage-page">
      <header class="page-head"><h1 class="page-title">${e(t.edit.manageTitle)}</h1>
        <p class="lede">${e(t.edit.manageIntro)}</p></header>${ctx.preview ? `
      <p class="manage-note">${e(t.edit.previewNote)}</p>` : ""}
      <p class="manage-signin" data-signin hidden><span data-signin-ok hidden>✓ ${e(t.edit.signedIn)}</span><span data-signin-no hidden>${e(t.edit.notSignedIn)}</span></p>
      <section class="manage-box manage-main">
        <h2>${e(t.edit.onPageTitle)}</h2>
        <p>${e(t.edit.onPageText)}</p>
        <a class="button button-large" href="${makeLink(ctx)("")}#edit">${e(t.edit.onPageButton)}</a>${data.projects.length ? `
        <p class="manage-projects-title">${e(t.edit.onPageProjects)}</p>
        <ul class="manage-projects">
          <li><a href="${makeLink(ctx)("work/")}#edit"><strong>${e(t.edit.onPageWorkPage)}</strong></a></li>
          <li><a href="${makeLink(ctx)("services/")}#edit"><strong>${e(t.edit.onPageServicesPage)}</strong></a></li>${data.projects.map((p) => `
          <li><a href="${makeLink(ctx)(`work/${p.slug}/`)}#edit">${e(p.title)}</a></li>`).join("")}
        </ul>` : ""}
      </section>
      <div class="manage-grid">
        <section class="manage-box">
          <h2>${e(t.edit.contentTitle)}</h2>
          <p>${e(t.edit.contentText)}</p>
          <a class="button button-large" href="${adminHref(ctx)}" target="_blank" rel="noopener">${e(t.edit.contentButton)}</a>
        </section>
        <section class="manage-box">
          <h2>${e(t.edit.commentsTitle)}</h2>
          <p>${e(t.edit.commentsText)}</p>
          <a class="button button-large" href="${communityHref(ctx)}" target="_blank" rel="noopener">${e(t.edit.commentsButton)}</a>
        </section>
        <section class="manage-box">
          <h2>${e(t.edit.buttonsTitle)}</h2>
          <p>${e(t.edit.buttonsText)}</p>
          <button type="button" class="button button-large" data-edit-toggle data-on="${e(t.edit.buttonsOn)}" data-off="${e(t.edit.buttonsOff)}">${e(t.edit.buttonsOn)}</button>
        </section>
      </div>
      <section class="manage-section" aria-labelledby="quick-title">
        <h2 id="quick-title" class="section-label">${e(t.edit.quickTitle)}</h2>
        <ul class="manage-quick">${quick.map(([label, hash]) => `
          <li><a href="${e(adminHref(ctx, hash))}" target="_blank" rel="noopener">${icon("edit")}<span>${e(label)}</span></a></li>`).join("")}
        </ul>
      </section>
      <section class="manage-section" aria-labelledby="first-title">
        <h2 id="first-title" class="section-label">${e(t.edit.firstTitle)}</h2>
        <h3>${e(t.edit.firstContent)}</h3>
        ${steps(t.edit.firstContentSteps)}
        <h3>${e(t.edit.firstComments)}</h3>
        ${steps(t.edit.firstCommentsSteps)}
      </section>
    </div>`,
  });
}

const pageTitle = (ctx, title) => `${title} — ${ctx.t.meta.titleSuffix}`;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function home(ctx) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  // A homepage picture opens its project's page only when a project was
  // chosen for it in the admin; otherwise it is for looking only.
  const linked = (g) => !!g.project;
  // Mosaic: pictures placed tightly in rows, with a minimal gap. Each row
  // holds 1 to 4 pictures, so their sizes change from row to row (one very
  // large, then two medium, then three or four small…). Pictures in a row
  // share one height and keep their own shape, so nothing is cropped.
  // A size chosen in the admin (large / medium / small) sets the row.
  const ratioOf = (g) => ratioClass(g.image).ratio;
  // Opening: the opening image (full width), the second opening picture in a
  // frame, and the tagline under them. The gallery follows.
  const opening = !!(data.hero && data.homeGallery.length && data.homeGallery[0].image.src === data.hero.src);
  // Rows for one screen size. counts: the rhythm of pictures per row.
  const buildRows = (counts, minSum, maxPer, sized) => {
    const out = [];
    let i = opening ? 1 : 0, k = 0; // the opening image is shown above the gallery
    if (!opening && data.homeGallery.length) { out.push([0]); i = 1; }
    while (i < data.homeGallery.length) {
      const size = data.homeGallery[i].image.size;
      let count = sized && size === "large" ? 1 : sized && size === "medium" ? 2 : sized && size === "small" ? 4 : counts[k++ % counts.length];
      // In the automatic rhythm only wide pictures fill a row alone; a picture
      // the owner marked "large" always gets its own row (narrow ones are
      // centred, at most about one screen high).
      if (count === 1 && ratioOf(data.homeGallery[i]) < 1.3 && !(sized && size === "large")) count = 2;
      count = Math.min(count, maxPer);
      const row = [];
      let sum = 0;
      // Rows of portraits would become very tall: add pictures until the
      // row is wide enough (minSum = width compared with height).
      // A size chosen by the owner is kept exactly; only the automatic
      // rhythm adds pictures to rows of tall pictures.
      const chosen = sized && ["large", "medium", "small"].includes(size);
      // A picture with its own chosen size starts its own row.
      const ownSize = (n) => sized && ["large", "medium", "small"].includes(data.homeGallery[n].image.size);
      while (i < data.homeGallery.length && (row.length < count || (!chosen && count > 1 && sum < minSum && row.length < maxPer)) && !(row.length && ownSize(i) && (!chosen || data.homeGallery[i].image.size !== size))) {
        row.push(i);
        sum += ratioOf(data.homeGallery[i]);
        i++;
      }
      out.push(row);
    }
    return out;
  };
  // Layout chosen in the admin: a fixed number of pictures per row (a size
  // chosen for one picture still wins), or the usual mixed rhythm.
  const lay = data.galleryLayout || {};
  // Free sizes (set by dragging in the page editor): each picture has a width
  // in % of the page. Rows are filled in order; pictures sharing a row are
  // stretched to fill it exactly and get one common height (cropped to it,
  // keeping the chosen focus), so no empty space is left. A picture alone in
  // its row keeps its width and whole shape, centred.
  const free = data.homeGallery.some((g, n) => (opening ? n > 0 : true) && g.image.fw);
  const freeRows = () => {
    const out = [];
    let i = opening ? 1 : 0, row = [], sum = 0;
    for (; i < data.homeGallery.length; i++) {
      const f = data.homeGallery[i].image.fw || 33;
      if (row.length && sum + f > 106) { out.push(row); row = []; sum = 0; }
      row.push(i); sum += f;
    }
    if (row.length) out.push(row);
    return out;
  };
  const freeClass = new Map(); // picture index -> class
  const rows = free ? freeRows() : lay.columns ? buildRows([lay.columns], 2.3, lay.columns, true) : buildRows([2, 3, 1, 3, 2, 4], 2.3, 5, true);
  if (free) {
    for (const row of rows) {
      const f = row.map((n) => data.homeGallery[n].image.fw || 33);
      const total = f.reduce((a, b) => a + b, 0);
      if (row.length === 1) {
        const w = Math.min(100, f[0]);
        const cls = `fs-${w}`;
        freeRules.set(cls, `.mrow>.${cls}{flex:none!important;width:${w}%;margin-inline:auto}`);
        freeClass.set(row[0], cls);
        continue;
      }
      const share = f.map((x) => x / total);
      const h = share.reduce((acc, s, k) => acc + s * (s * 100 / ratioOf(data.homeGallery[row[k]])), 0);
      row.forEach((n, k) => {
        const grow = Math.round(share[k] * 1000), ar = Math.round((share[k] * 100 / h) * 100) / 100;
        const cls = `fr-${grow}-${String(ar).replace(".", "_")}`;
        freeRules.set(cls, `.mrow>.${cls}{flex:${grow} 1 0!important;min-width:0}.mrow>.${cls} .jg-media{aspect-ratio:${ar}}.mrow>.${cls} .jg-media img{object-fit:cover}`);
        freeClass.set(n, cls);
      });
    }
  }
  // Phones: at most two pictures side by side, in the same tight style.
  const rowsSmall = lay.phone ? buildRows([lay.phone], 1.4, lay.phone, false) : buildRows([2, 1, 2, 2], 1.4, 2, false);
  const cell = (n, rowLen) => {
    const g = data.homeGallery[n];
    const own = !linked(g) && g.image.link;
    return galleryItem(ctx, g.image, {
      caption: g.caption,
      lead: n === 0,
      eager: n === 0,
      // Opens its project, or its own link; otherwise the picture opens large.
      href: linked(g) ? link(`work/${g.project.slug}/`) : own ? linkOf(ctx, g.image.link) : ctx.assetBase + e(g.image.full || g.image.src),
      label: linked(g) ? `${g.project.name} — ${t.home.openProject}` : own ? g.image.alt : `${t.work.openImage}: ${g.image.alt}`,
      external: !!(own && g.image.link.external),
      viewer: !linked(g) && !own,
      sizes: rowLen === 1 ? "(max-width: 1440px) 100vw, 1440px" : `(max-width: 700px) ${rowLen > 2 ? 50 : 60}vw, ${Math.round(100 / rowLen) + 10}vw`,
      extraClass: freeClass.get(n) || "",
    });
  };
  // Free widths of the opening pictures (computers).
  const openW = (kind, w) => {
    if (!w) return "";
    const cls = `ow-${kind}-${w}`;
    freeRules.set(cls, `.${cls}{max-width:${w}%!important;margin-inline:auto}`);
    return ` ${cls}`;
  };
  // Each picture also carries its place in the phone layout (row "s" of
  // rowsSmall); js/main.js moves the pictures into those rows on phones.
  const smallRowOf = new Map();
  rowsSmall.forEach((row, r) => row.forEach((n) => smallRowOf.set(n, `${r}:${row.length}`)));
  const feature = data.feature
    ? galleryItem(ctx, data.feature.image, {
        href: data.feature.project ? link(`work/${data.feature.project.slug}/`) : ctx.assetBase + e(data.feature.image.full || data.feature.image.src),
        label: data.feature.project ? `${data.feature.project.name} — ${t.home.openProject}` : `${t.work.openImage}: ${data.feature.image.alt}`,
        viewer: !data.feature.project,
        sizes: lay.feature === "full" ? "(max-width: 1440px) 100vw, 1440px" : "(max-width: 700px) 92vw, 960px",
      })
    : "";
  // One short line saying what a click on a picture does, at the bottom of
  // the page (owner's choice).
  const hint = t.home.hint;
  const openingBlock = opening || feature
    ? `
    <section class="opening" aria-label="BubaPix">${opening ? `
      <div class="opening-hero${openW("h", lay.heroW)}">${cell(0, 1)}</div>` : ""}${feature ? `
      <div class="opening-feature${lay.feature ? ` feature-${lay.feature}` : ""}${openW("f", lay.featureW)}">${feature}</div>` : ""}${data.tagline ? `
      <p class="tagline opening-tagline">${e(data.tagline)}</p>` : ""}
    </section>`
    : "";
  // Posters in tight rows of the same height (no empty space under shorter
  // posters): three in a row, the last rows balanced (4 → 2+2, 5 → 3+2).
  const posterRows = (list) => {
    const out = [];
    let i = 0;
    while (i < list.length) {
      const left = list.length - i;
      const n = left === 4 ? 2 : left <= 3 ? left : 3;
      out.push(list.slice(i, i + n));
      i += n;
    }
    return out;
  };
  // Phones: posters two by two, same height in each pair (an odd last one alone).
  const posterPhoneRow = (list, p) => {
    const i = list.indexOf(p), last = list.length - 1;
    const r = Math.floor(i / 2), size = list.length % 2 && i === last ? 1 : 2;
    return `${r}:${size}`;
  };
  // Projects: one poster per project; each opens its own project page.
  // Shown from two projects up (with one, it would repeat the opening image).
  const posterProjects = data.posters;
  // Free poster sizes from the page editor (computers): same rows rule as the
  // galleries; phones keep two by two.
  const posterLayout = { rows: [], cls: new Map() };
  if (posterProjects.some((p) => p.posterW)) {
    const fr = freeClasses(posterProjects.map((p) => ({ ...p.thumb, fw: p.posterW })));
    posterLayout.rows = fr.rows.map((r) => r.map((i) => posterProjects[i]));
    posterProjects.forEach((p, i) => posterLayout.cls.set(p, fr.classes[i]));
  } else posterLayout.rows = posterRows(posterProjects);
  const posters = posterProjects.length
    ? `
    <section class="section home-posters" aria-labelledby="posters-title">
      <h2 id="posters-title" class="visually-hidden">${e(t.nav.work)}</h2>
      <div class="mosaic poster-rows${lay.gap ? ` gap-${lay.gap}` : ""}" data-mosaic>${posterLayout.rows.map((row) => `
        <div class="mrow n${row.length}">${row.map((p) => galleryItem(ctx, p.thumb, { href: link(`work/${p.slug}/`), label: `${p.name} — ${t.home.openProject}`, sizes: `(max-width: 700px) 50vw, ${Math.round(100 / row.length) + 5}vw`, extraClass: `poster${posterLayout.cls.get(p) ? " " + posterLayout.cls.get(p) : ""}` }).replace(/^<(a|figure) /, `<$1 data-project="${e(p.slug)}" data-srow="${posterPhoneRow(posterProjects, p)}" `)).join("")}</div>`).join("")}
      </div>
    </section>`
    : "";
  const items = rows.map((row) => `<div class="mrow n${row.length}">${row.map((n) => cell(n, row.length).replace(/^<(a|figure) /, `<$1 data-srow="${smallRowOf.get(n)}" `)).join("")}</div>`);
  const work = items.length
    ? `
    <section class="section section-work" aria-labelledby="work-title">
      <h2 id="work-title" class="visually-hidden">${e(t.home.workTitle)}</h2>
      <div class="mosaic jg-home${lay.gap ? ` gap-${lay.gap}` : ""}" data-mosaic>
        ${items.join("\n        ")}
      </div>
    </section>`
    : "";
  const tagline = data.tagline && !openingBlock ? `
    <p class="tagline">${e(data.tagline)}</p>` : "";
  // Showreel: only when a video link is set in the admin.
  const showreel = data.showreel
    ? `
    <section class="section section-showreel" aria-labelledby="showreel-title">
      <h2 id="showreel-title" class="section-label">${e(t.home.showreel)}</h2>
      ${videoBlock(ctx, { embed: data.showreel, file: "", title: "" }, "BubaPix", null)}
    </section>`
    : "";
  // Services: the approved service names from the Services page.
  const services = data.services.items.length
    ? `
    <section class="section home-services" aria-labelledby="home-services-title">
      <div class="section-head">
        <h2 id="home-services-title" class="section-label">${e(t.nav.services)}</h2>
        <a class="text-link" href="${link("services/")}">${e(t.home.allServices)}</a>
      </div>
      <ul class="home-service-list">${data.services.items.map((x) => `
        <li>${e(x.name)}</li>`).join("")}
      </ul>
    </section>`
    : "";
  // "Start a project" appears only when the Contact page offers a working way
  // to reach the studio (email, phone, or the private message form).
  const canContact = !!(data.contact.email || data.contact.email2 || data.contact.phone || data.participation.consult);
  const start = canContact
    ? `
    <section class="section start-project">
      <a class="button button-large" href="${link("contact/")}">${e(t.home.startProject)}</a>
    </section>`
    : "";
  const intro = data.intro
    ? `
    <section class="section intro" aria-label="${e(t.nav.about)}">
      <p class="intro-text">${e(data.intro)}</p>
    </section>`
    : "";

  return layout(ctx, {
    edits: [[t.edit.gallery, ed.site], [t.edit.tagline, ed.site], [t.edit.services, ed.services], [t.edit.newProject, ed.newProject]],
    pageEditor: true,
    title: t.meta.homeTitle,
    viewer: true,
    description: data.seoDescription || data.intro,
    main: `    <h1 class="visually-hidden">BubaPix</h1>${openingBlock}${tagline}${posters}${showreel}${work}${services}${intro}${start}${hint ? `
    <p class="page-hint bottom-hint">${e(hint)}</p>` : ""}`,
  });
}

function work(ctx) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const used = data.categories.filter((c) => data.projects.some((p) => p.categories.some((pc) => pc.slug === c.slug)));
  const filters = used.length > 1 || (used.length === 1 && data.projects.some((p) => !p.categories.length))
    ? `
      <div class="filters" role="group" aria-label="${e(t.a11y.filterLabel)}" hidden>
        <button type="button" class="filter" data-filter="" aria-pressed="true">${e(t.work.all)}</button>${used.map((c) => `
        <button type="button" class="filter" data-filter="${e(c.slug)}" aria-pressed="false">${e(c.name)}</button>`).join("")}
      </div>`
    : "";
  // Free sizes from the page editor (computers): same rows rule as project galleries.
  const free = data.projects.some((p) => p.listW) ? freeClasses(data.projects.map((p) => ({ ...p.thumb, fw: p.listW }))) : null;
  const items = data.projects.map((p, i) =>
    galleryItem(ctx, p.thumb, {
      href: link(`work/${p.slug}/`),
      label: p.title,
      caption: p.titleInGallery ? { title: p.name, note: p.categories.map((c) => c.name).join(", ") } : null,
      extraClass: free ? free.classes[i] : "",
    }).replace(/<a class="jg-item/, `<a data-categories="${e(p.categories.map((c) => c.slug).join(" "))}" class="jg-item`)
  );
  const grid = !items.length
    ? `<p class="muted">${e(t.work.empty)}</p>`
    : free
      ? `<div class="jg-work jg-free">
        ${free.rows.map((r) => `<div class="mrow n${r.length}">${r.map((i) => items[i]).join("")}</div>`).join("\n        ")}
      </div>`
      : gallery(items, "jg-work");
  return layout(ctx, {
    edits: [...data.projects.map((p) => [t.edit.project.replace("{name}", p.title), ed.project(p.slug)]), [t.edit.newProject, ed.newProject]],
    title: pageTitle(ctx, t.work.title),
    description: data.seoDescription,
    current: "work",
    pageEditor: "work",
    main: `
    <div class="page" data-work-page>
      <header class="page-head"><h1 class="page-title" data-work-title>${e(t.work.title)}</h1></header>${filters}
      ${grid}${items.length && t.work.hint ? `
      <p class="page-hint bottom-hint" data-work-hint>${e(t.work.hint)}</p>` : ""}
    </div>`,
  });
}

function videoBlock(ctx, v, projectTitle, poster) {
  const { t } = ctx;
  const title = `${projectTitle} — ${v.title || t.work.video}`;
  let player = "";
  if (v.embed && v.embed.kind === "youtube") {
    player = `<iframe src="https://www.youtube-nocookie.com/embed/${e(v.embed.id)}" title="${e(title)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  } else if (v.embed && v.embed.kind === "vimeo") {
    player = `<iframe src="https://player.vimeo.com/video/${e(v.embed.id)}?dnt=1" title="${e(title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } else if (v.file) {
    player = `<video controls preload="metadata" playsinline${poster ? ` poster="${ctx.assetBase}${e(poster.src)}"` : ""}><source src="${ctx.assetBase}${e(v.file)}" type="${/\.webm$/i.test(v.file) ? "video/webm" : "video/mp4"}"></video>`;
  }
  return `<figure class="video-item"><div class="video">${player}</div>${v.title ? `<figcaption class="video-title">${e(v.title)}</figcaption>` : ""}</figure>`;
}

// Free sizes (set by dragging in the page editor): each picture has a width in
// % of the page. Rows are filled in order; pictures sharing a row are
// stretched to fill it exactly with one common height (cropped to it), so no
// empty space is left. A picture alone in its row keeps its width, centred.
// Returns one CSS class per picture (computers only; see build.js).
function freeClasses(list) {
  const rows = [];
  let row = [], sum = 0;
  list.forEach((im, i) => {
    const f = im.fw || 33;
    if (row.length && sum + f > 106) { rows.push(row); row = []; sum = 0; }
    row.push(i); sum += f;
  });
  if (row.length) rows.push(row);
  const classes = [];
  for (const r of rows) {
    const f = r.map((i) => list[i].fw || 33);
    if (r.length === 1) {
      const w = Math.min(100, f[0]);
      const cls = `fs-${w}`;
      freeRules.set(cls, `.mrow>.${cls}{flex:none!important;width:${w}%;margin-inline:auto}`);
      classes[r[0]] = cls;
      continue;
    }
    const total = f.reduce((a, b) => a + b, 0);
    const share = f.map((x) => x / total);
    const h = share.reduce((acc, s, k) => acc + s * (s * 100 / ratioClass(list[r[k]]).ratio), 0);
    r.forEach((i, k) => {
      const grow = Math.round(share[k] * 1000), ar = Math.round((share[k] * 100 / h) * 100) / 100;
      const cls = `fr-${grow}-${String(ar).replace(".", "_")}`;
      freeRules.set(cls, `.mrow>.${cls}{flex:${grow} 1 0!important;min-width:0}.mrow>.${cls} .jg-media{aspect-ratio:${ar}}.mrow>.${cls} .jg-media img{object-fit:cover}`);
      classes[i] = cls;
    });
  }
  return { rows, classes };
}

// Pictures inside a project page: open in the image viewer.
function projectPictures(ctx, list) {
  const item = (im, extraClass = "") =>
    galleryItem(ctx, im, {
      href: im.link ? linkOf(ctx, im.link) : ctx.assetBase + e(im.full || im.src),
      label: im.link ? im.alt : `${ctx.t.work.openImage}: ${im.alt}`,
      caption: im.caption !== "hidden" ? { title: im.title, note: im.note } : null,
      viewer: !im.link,
      external: !!(im.link && im.link.external),
      extraClass,
    });
  if (list.some((im) => im.fw)) {
    const { rows, classes } = freeClasses(list);
    return `<div class="jg-project jg-free">
        ${rows.map((r) => `<div class="mrow n${r.length}">${r.map((i) => item(list[i], classes[i])).join("")}</div>`).join("\n        ")}
      </div>`;
  }
  return gallery(list.map((im) => item(im)), "jg-project");
}

function projectSection(ctx, p, sec, i) {
  const { t } = ctx;
  const id = `section-${i + 1}`;
  const head = (fallback) => {
    const h = sec.heading || fallback;
    return h ? `<h2 id="${id}" class="section-label">${e(h)}</h2>` : "";
  };
  const open = (fallback, extra = "") => {
    const h = sec.heading || fallback;
    return `
      <section class="project-section ${extra}"${h ? ` aria-labelledby="${id}"` : ""}>
        ${head(fallback)}`;
  };
  if (sec.type === "creators") {
    return `${open(t.work.creators, "creators")}
        <ul class="creators">${sec.items.map((c) => `
          <li><figure>${c.text ? `<blockquote><p>${e(c.text)}</p></blockquote>` : ""}<figcaption><span class="creator-name">${e(c.name)}</span>${c.role ? `<span class="muted">${e(c.role)}</span>` : ""}</figcaption></figure></li>`).join("")}
        </ul>
      </section>`;
  }
  if (sec.type === "behind" || sec.type === "gallery") {
    const body = sec.body ? `<div class="prose">${md(sec.body)}</div>` : "";
    return `${open(sec.type === "behind" ? t.work.behind : t.work.gallery)}
        ${body}${sec.images.length ? projectPictures(ctx, sec.images) : ""}
      </section>`;
  }
  if (sec.type === "videos") {
    return `${open(t.work.video, "videos")}
        ${sec.videos.map((v) => videoBlock(ctx, v, p.title, p.cover)).join("\n        ")}
      </section>`;
  }
  if (sec.type === "text") {
    return `${open("")}
        <div class="prose">${md(sec.body)}</div>
      </section>`;
  }
  if (sec.type === "details") {
    return `${open(t.work.details)}
        <dl class="details">${sec.items.map((d) => `<div><dt>${e(d.label)}</dt><dd>${e(d.value)}</dd></div>`).join("")}</dl>
      </section>`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Visitor participation (comments, questions, ratings, ideas, consultations)
// Forms are hidden until js/community.js starts; without JavaScript a short
// note is shown instead. Visitor text is always inserted as plain text.
// ---------------------------------------------------------------------------

function participationForm(ctx, kind, { project = "" } = {}) {
  const { t } = ctx;
  const link = makeLink(ctx);
  const c = t.community;
  const emailRequired = kind === "consult";
  const messageLabel = kind === "idea" ? t.ideas.ideaLabel : c.messageLabel;
  const emailLabel = emailRequired ? t.consult.emailLabel : c.emailLabel;
  const type = kind === "comment"
    ? `
          <fieldset class="cform-type">
            <legend>${e(c.typeLabel)}</legend>
            <label><input type="radio" name="kind" value="comment" checked> ${e(c.typeComment)}</label>
            <label><input type="radio" name="kind" value="question"> ${e(c.typeQuestion)}</label>
          </fieldset>`
    : `
          <input type="hidden" name="kind" value="${kind}">`;
  return `<form class="cform" data-form="${kind}"${project ? ` data-project="${e(project)}"` : ""} novalidate>${type}
          <label class="field"><span>${e(c.nameLabel)}</span><input name="name" maxlength="60" required autocomplete="nickname"></label>
          <label class="field"><span>${e(messageLabel)}</span><textarea name="message" maxlength="2000" rows="5" required></textarea></label>
          <label class="field"><span>${e(emailLabel)}</span><input type="email" name="email" maxlength="254" autocomplete="email" dir="ltr"${emailRequired ? " required" : ""}></label>
          <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>${kind === "idea" ? `
          <label class="check"><input type="checkbox" name="publicOk"> <span>${e(t.ideas.publicOk)}</span></label>` : ""}
          <p class="form-note">${e(c.privacy)} <a href="${link("privacy/")}">${e(c.privacyLink)}</a></p>
          <button type="submit" class="button">${e(c.send)}</button>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>`;
}

function noscript(ctx) {
  return `<noscript><p class="muted">${e(ctx.t.community.noscript)}</p></noscript>`;
}

function communitySection(ctx, p) {
  const c = ctx.t.community;
  const on = ctx.data.participation;
  const showRatings = on.ratings;
  const showComments = on.comments && p.comments;
  const stars = [1, 2, 3, 4, 5]
    .map((n) => `<button type="button" class="star" data-value="${n}" aria-label="${e(c.rateStar.replace("{n}", n))}">★</button>`)
    .join("");
  const title = showComments && showRatings ? c.sectionTitle : showComments ? c.commentsTitle : c.rateTitle;
  return `
      <section class="project-section community" aria-labelledby="community-title" data-project="${e(p.slug)}">
        <h2 id="community-title" class="section-label">${e(title)}</h2>
        ${noscript(ctx)}
        <div class="community-body" data-community hidden>${showRatings ? `
          <div class="rating">
            <p class="rating-summary" data-rating-summary></p>
            <div class="rate" data-rate>
              <p class="community-h" id="rate-title">${e(c.rateTitle)}</p>
              <div class="stars" role="group" aria-labelledby="rate-title">${stars}</div>
            </div>
            <p class="form-status" role="status" aria-live="polite" data-rate-status></p>
          </div>` : ""}${showComments ? `
          <div class="comments-block">
            ${showRatings ? `<h3 class="community-h">${e(c.commentsTitle)}</h3>` : ""}
            <ol class="comments" data-list="comments"></ol>
            <p class="muted" data-empty hidden>${e(c.commentsEmpty)}</p>
          </div>
          ${participationForm(ctx, "comment", { project: p.slug })}` : ""}
        </div>
      </section>`;
}

function project(ctx, p, prev, next) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const cats = p.categories.map((c) => c.name).join(", ");
  let coverCls = "";
  if (p.cover && p.coverW) {
    coverCls = ` cw-${p.coverW}`;
    freeRules.set(`cw-${p.coverW}`, `.cw-${p.coverW}{max-width:${p.coverW}%!important;margin-inline:auto}`);
  }
  const cover = p.cover
    ? `
      <figure class="project-cover${coverCls}"><a href="${ctx.assetBase}${e(p.cover.full || p.cover.src)}" data-viewer aria-label="${e(`${t.work.openImage}: ${p.cover.alt}`)}">${img(ctx, p.cover, { sizes: "(max-width: 1440px) 100vw, 1440px", attrs: 'fetchpriority="high" decoding="async"' })}</a></figure>`
    : "";
  const synopsis = p.description
    ? `
      <section class="project-section" aria-labelledby="synopsis-title">
        <h2 id="synopsis-title" class="section-label">${e(t.work.synopsis)}</h2>
        <div class="prose prose-large">${md(p.description)}</div>
      </section>`
    : "";
  const community = (data.participation.comments && p.comments) || data.participation.ratings ? communitySection(ctx, p) : "";
  const pagerLink = (q, cls, label) =>
    q ? `<a class="${cls}" href="${link(`work/${q.slug}/`)}"><span>${e(label)}</span>${q.name ? e(q.name) : ""}</a>` : "<span></span>";
  return layout(ctx, {
    edits: [[t.edit.thisProject, ed.project(p.slug)], ...(ctx.data.participation.comments ? [[t.edit.comments, "", true]] : []), [t.edit.newProject, ed.newProject]],
    title: p.seoTitle || pageTitle(ctx, p.title),
    description: p.seoDescription || p.text || ctx.data.seoDescription,
    image: p.thumb,
    current: "work",
    community: !!community,
    viewer: true,
    pageEditor: "project",
    main: `
    <article class="page project" data-slug="${e(p.slug)}">
      <header class="page-head">
        <p class="crumb"><a href="${link("work/")}">${e(t.work.back)}</a></p>
        <h1 class="${p.showTitle ? "page-title" : "visually-hidden"}" data-project-title>${e(p.title)}</h1>${cats ? `
        <p class="project-meta">${e(cats)}</p>` : ""}${p.text ? `
        <p class="lede">${e(p.text)}</p>` : ""}
      </header>${cover}${synopsis}${p.sections.map((sec, i) => projectSection(ctx, p, sec, i)).join("")}${p.products && p.products.length ? `
      <section class="project-section" aria-labelledby="project-shop-title">
        <h2 id="project-shop-title" class="section-label">${e(t.shop.projectShop)}</h2>
        <div class="product-grid">
          ${p.products.map((x) => productCard(ctx, x)).join("\n          ")}
        </div>
      </section>` : ""}${community}
      <nav class="pager" aria-label="${e(t.work.title)}">
        ${pagerLink(prev, "pager-prev", t.work.previous)}
        ${pagerLink(next, "pager-next", t.work.next)}
      </nav>
    </article>`,
  });
}

function services(ctx) {
  const { t, data } = ctx;
  const s = data.services;
  return layout(ctx, {
    edits: [[t.edit.services, ed.services]],
    title: pageTitle(ctx, t.services.title),
    description: s.intro || data.seoDescription,
    current: "services",
    pageEditor: "page",
    main: `
    <div class="page" data-ed-file="content/services.json">
      <header class="page-head"><h1 class="page-title" data-ed-label="nav_services">${e(t.services.title)}</h1>${s.intro ? `
        <p class="lede" data-ed="intro">${e(s.intro)}</p>` : ""}</header>
      <ul class="service-list" data-ed-list="services" data-ed-subs="name,text">${s.items.map((x) => `
        <li data-ed-item="${x.i}"><h2 data-ed-sub="name">${e(x.name)}</h2>${x.text ? `<p data-ed-sub="text">${e(x.text)}</p>` : ""}</li>`).join("")}
      </ul>${s.process.length ? `
      <section class="section-inner" aria-labelledby="process-title">
        <h2 id="process-title" class="section-label" data-ed="process_title">${e(s.processTitle)}</h2>
        <ol class="steps" data-ed-list="process" data-ed-subs="name,text">${s.process.map((x, i) => `
          <li data-ed-item="${x.i}"><span class="step-num" data-ed-num>${i + 1}</span><h3 data-ed-sub="name">${e(x.name)}</h3>${x.text ? `<p data-ed-sub="text">${e(x.text)}</p>` : ""}</li>`).join("")}
        </ol>
      </section>` : ""}
    </div>`,
  });
}

function about(ctx) {
  const { t, data } = ctx;
  const a = data.about;
  return layout(ctx, {
    edits: [[t.edit.about, ed.about]],
    title: pageTitle(ctx, t.about.title),
    description: data.seoDescription,
    current: "about",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.about.title)}</h1></header>
      <div class="about-layout">
        <div class="prose prose-large">${md(a.body)}</div>
        ${logo(ctx, t.footer.logoAlt, "logo-full", 'loading="lazy" decoding="async"')}
      </div>${a.team.length ? `
      <section class="section-inner" aria-labelledby="team-title">
        <h2 id="team-title" class="section-label">${e(t.about.team)}</h2>
        <ul class="team">${a.team.map((m) => `
          <li>${m.photo ? img(ctx, m.photo, { sizes: "(max-width: 560px) 100vw, 25vw" }) : ""}<h3>${e(m.name)}</h3>${m.role ? `<p class="muted">${e(m.role)}</p>` : ""}${m.bio ? `<p>${e(m.bio)}</p>` : ""}</li>`).join("")}
        </ul>
      </section>` : ""}
    </div>`,
  });
}

function testimonials(ctx) {
  const { t, data } = ctx;
  return layout(ctx, {
    title: pageTitle(ctx, t.testimonials.title),
    description: data.seoDescription,
    current: "testimonials",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.testimonials.title)}</h1></header>
      <ul class="quotes">${data.testimonials.map((q) => `
        <li><figure><blockquote><p>${e(q.quote)}</p></blockquote><figcaption><span class="quote-name">${e(q.name)}</span>${q.role ? `<span class="muted">${e(q.role)}</span>` : ""}</figcaption></figure></li>`).join("")}
      </ul>
    </div>`,
  });
}

function contact(ctx) {
  const { t, data } = ctx;
  const c = data.contact;
  const rows = [
    (c.email || c.email2) && [t.contact.email, [c.email, c.email2].filter(Boolean).map((m) => `<a class="contact-link" href="mailto:${e(m)}">${e(m)}</a>`).join("<br>")],
    c.phone && [t.contact.phone, `<a class="contact-link" href="tel:${e(c.phone.replace(/[^\d+]/g, ""))}">${e(c.phone)}</a>`],
    c.location && [t.contact.location, `<span>${e(c.location)}</span>`],
  ].filter(Boolean);
  const social = c.social.length
    ? `<div><dt>${e(t.contact.social)}</dt><dd>${socialList(ctx, "social social-named", true)}</dd></div>`
    : "";
  return layout(ctx, {
    edits: [[t.edit.contact, ed.contact], ...(data.participation.consult ? [[t.edit.comments, "", true]] : [])],
    title: pageTitle(ctx, t.contact.title),
    description: c.intro || data.seoDescription,
    current: "contact",
    community: data.participation.consult,
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.contact.title)}</h1>${c.intro ? `
        <p class="lede">${e(c.intro)}</p>` : ""}</header>
      ${rows.length || social
        ? `<dl class="contact-list">${rows.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${v}</dd></div>`).join("")}${social}</dl>`
        : data.participation.consult ? "" : `<p class="muted">${e(t.contact.pending)}</p>`}${data.participation.consult ? `
      <section class="section-inner community" aria-labelledby="consult-title">
        <h2 id="consult-title" class="section-label">${e(t.consult.title)}</h2>
        <p class="lede">${e(t.consult.intro)}</p>
        ${noscript(ctx)}
        <div class="community-body" data-community hidden>
          ${participationForm(ctx, "consult")}
        </div>
${data.participation.ideas ? `
        <p><a class="text-link" href="${makeLink(ctx)("ideas/")}">${e(t.ideas.link)}</a></p>` : ""}
      </section>` : ""}
    </div>`,
  });
}

function ideas(ctx) {
  const { t, data } = ctx;
  return layout(ctx, {
    title: pageTitle(ctx, t.ideas.title),
    description: t.ideas.intro,
    current: "ideas",
    community: true,
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.ideas.title)}</h1>
        <p class="lede">${e(t.ideas.intro)}</p></header>
      <section class="community">
        ${noscript(ctx)}
        <div class="community-body" data-community hidden>
          ${participationForm(ctx, "idea")}
          <div class="comments-block">
            <h2 class="section-label">${e(t.ideas.published)}</h2>
            <ol class="comments" data-list="ideas"></ol>
            <p class="muted" data-empty hidden>${e(t.ideas.empty)}</p>
          </div>
        </div>
      </section>
    </div>`,
  });
}

function privacy(ctx) {
  const { t, data } = ctx;
  // Lines that are true only in some setups are shown only then.
  const items = [...t.privacy.items];
  if (data.participation.ratings) items.splice(5, 0, t.privacy.ratings);
  if (!data.analytics) items.splice(items.length - 1, 0, t.privacy.noAnalytics);
  return layout(ctx, {
    title: pageTitle(ctx, t.privacy.title),
    description: t.privacy.items[0],
    current: "privacy",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.privacy.title)}</h1></header>
      <div class="prose prose-large">
        <ul>${items.map((x) => `
          <li>${e(x)}</li>`).join("")}
        </ul>
        <p><a class="text-link" href="${makeLink(ctx)("contact/")}">${e(t.consult.title)}</a></p>
      </div>
    </div>`,
  });
}

// Accessibility statement (Israeli regulation 35 / SI 5568). Texts in src/i18n.
function accessibility(ctx) {
  const { t, data } = ctx;
  const a = t.accessibility;
  const mails = [data.contact.email].filter(Boolean);
  const list = (items) => `<ul>${items.map((x) => `
          <li>${e(x)}</li>`).join("")}
        </ul>`;
  return layout(ctx, {
    title: pageTitle(ctx, a.title),
    description: a.intro,
    current: "accessibility",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(a.title)}</h1><p class="muted">${e(a.updated)}</p></header>
      <div class="prose prose-large">
        <p>${e(a.intro)}</p>
        <h2>${e(a.standardTitle)}</h2>
        <p>${e(a.standard)}</p>
        <h2>${e(a.doneTitle)}</h2>
        ${list(a.done)}
        <h2>${e(a.testedTitle)}</h2>
        <p>${e(a.tested)}</p>
        <h2>${e(a.notYetTitle)}</h2>
        ${list(a.notYet)}
        <h2>${e(a.contactTitle)}</h2>
        <p>${e(a.contact)}</p>${mails.length ? `
        <p>${e(a.email)} ${mails.map((m) => `<a class="text-link" href="mailto:${e(m)}">${e(m)}</a>`).join(", ")}</p>` : ""}
        <p>${e(a.contactTip)}</p>
      </div>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
// Link to the visitor's order; js/shop.js shows it once something is added.
const orderLink = (ctx) => `<a class="order-link" href="${makeLink(ctx)("shop/order/")}" data-order-link hidden>${e(ctx.t.shop.viewOrder)} (<span data-order-count>0</span>)</a>`;

// The amount and currency of a price, for js/shop.js (approximate prices in
// the visitor's chosen currency).
const priceAttrs = (amount, currency, from) =>
  amount === null ? "" : ` data-amount="${amount}" data-cur="${e(currency)}"${from ? ' data-from="1"' : ""}`;

// "Show prices in" chooser. Shown by js/shop.js only when exchange rates exist.
function currencyPicker(ctx) {
  const { t, data } = ctx;
  const cur = data.shop.currency;
  if (!cur.codes.length) return "";
  return `
      <div class="currency-pick" data-currency-box hidden>
        <label><span>${e(t.shop.showIn)}</span>
          <select data-currency-pick>
            <option value="">${e(t.shop.originalCurrency)}</option>${cur.codes.map((c) => `
            <option value="${c}">${c}</option>`).join("")}
          </select>
        </label>
        <p class="currency-note" data-currency-note hidden></p>
      </div>`;
}

// "From" before a price: "From ₪89" in English, "החל מ־89 ₪" in Hebrew (no space after the maqaf).
const fromPrefix = (ctx) => e(ctx.t.shop.from) + (/־$/.test(ctx.t.shop.from) ? "" : " ");

// Price text, formatted like the build does.
const money = (ctx, amount, currency) =>
  new Intl.NumberFormat(ctx.lang === "he" ? "he-IL" : "en-US", { style: "currency", currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);

// VAT note next to a price ("incl. VAT"), when VAT is set in the admin.
const vatNote = (ctx) => {
  const v = ctx.data.shop.vat;
  if (!v || v.mode === "none") return "";
  return `<span class="vat-note">${e(v.mode === "included" ? ctx.t.shop.vatNoteIncluded : ctx.t.shop.vatNoteAdded)}</span>`;
};
const exampleTag = (ctx, on) => (on ? ` <span class="example-tag">(${e(ctx.t.shop.exampleValue)})</span>` : "");

// One product box in the shop: photo, name, price, and a clear button.
function productCard(ctx, x) {
  const link = makeLink(ctx);
  const { t } = ctx;
  const href = link(`shop/${x.slug}/`);
  const sub = [x.category && x.category.name, x.availability !== "available" && t.shop.availability[x.availability], x.type === "digital" && t.shop.types.digital].filter(Boolean);
  return `<article class="product-card" data-categories="${e(x.category ? [x.category.slug, x.category.parent].filter(Boolean).join(" ") : "")}">
          <a class="product-media${x.cardFit === "fill" ? ` is-fill focus-${x.cardFocus}` : ""}" href="${href}" tabindex="-1" aria-hidden="true">${img(ctx, x.thumb, { sizes: "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 33vw" })}</a>
          <div class="product-body">${x.example ? `
            <p class="example-badge">${e(t.shop.exampleBadge)}</p>` : ""}
            <h2 class="product-name"><a href="${href}">${e(x.title)}</a></h2>${sub.length ? `
            <p class="product-sub">${sub.map(e).join(" · ")}</p>` : ""}${x.priceText ? `
            <p class="product-price-row"><span class="product-price"${priceAttrs(x.price, x.currency, x.priceFrom)}>${x.priceFrom ? fromPrefix(ctx) : ""}${e(x.priceText)}</span>${vatNote(ctx)}</p>` : ""}
            <a class="button product-cta" href="${href}">${e(t.shop.details)}</a>
          </div>
        </article>`;
}

function shop(ctx) {
  const { t, data } = ctx;
  const cats = data.shop.categories;
  // Category tiles in a sideways-scrolling row: picture (or first letter),
  // name, and how many products, or "coming soon". Choosing one shows only
  // its products; "All" shows everything.
  const tile = (slug, name, media, count, pressed) => `
        <button type="button" class="filter cat-tile" data-filter="${e(slug)}" aria-pressed="${pressed}">
          <span class="cat-media">${media}</span>
          <span class="cat-name">${e(name)}</span>
          <span class="cat-count">${e(count === 1 ? t.shop.itemsOne : count ? t.shop.items.replace("{n}", count) : t.shop.comingSoon)}</span>
        </button>`;
  const filters = cats.length
    ? `
      <div class="filters cat-strip" role="group" aria-label="${e(t.shop.categoriesLabel)}" hidden>${tile("", t.shop.all, `<span class="cat-letter">${icon("grid")}</span>`, data.products.length, true)}${cats.filter((c) => !c.parent).map((c) => tile(c.slug, c.name, c.image ? img(ctx, c.image, { sizes: "120px" }) : `<span class="cat-letter">${e([...c.name][0] || "")}</span>`, c.count, false)).join("")}
      </div>${cats.filter((c) => c.subs && c.subs.length).map((c) => `
      <div class="filters sub-strip" role="group" aria-label="${e(c.name)}" data-parent="${e(c.slug)}" hidden>
        <button type="button" class="filter sub-chip" data-filter="${e(c.slug)}" aria-pressed="false">${e(t.shop.all)}</button>${c.subs.map((s) => `
        <button type="button" class="filter sub-chip" data-filter="${e(s.slug)}" aria-pressed="false">${e(s.name)} <span class="sub-count">${e(s.count ? String(s.count) : t.shop.comingSoon)}</span></button>`).join("")}
      </div>`).join("")}
      <p class="shop-empty cat-empty" data-filter-empty hidden>${e(t.shop.categoryEmpty)}</p>`
    : "";
  const grid = data.products.length
    ? `
      <div class="product-grid">
        ${data.products.map((x) => productCard(ctx, x)).join("\n        ")}
      </div>`
    : `
      <p class="shop-empty">${e(t.shop.empty)}</p>`;
  return layout(ctx, {
    edits: [[t.edit.newProduct, ed.newProduct], [t.edit.shopSettings, ed.shop], ...data.products.map((x) => [t.edit.product.replace("{name}", x.title), ed.product(x.slug)])],
    title: pageTitle(ctx, t.shop.title),
    description: data.shop.intro || data.seoDescription,
    current: "shop",
    main: `
    <div class="page">
      <header class="page-head shop-head"><h1 class="page-title">${e(t.shop.title)}</h1>${orderLink(ctx)}${data.shop.intro ? `
        <p class="lede">${e(data.shop.intro)}</p>` : ""}</header>${filters}${data.products.some((x) => x.priceText) ? currencyPicker(ctx) : ""}${grid}
    </div>`,
    shopScript: true,
  });
}

function product(ctx, x) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const c = data.contact;
  // The buy button never pretends: it opens the product's own buy link, or an
  // order email to the address on the Contact page. Without either, no button.
  // Buying: an external buy link when set; otherwise the visitor adds the
  // product to an order and sends it as an order request by email (no online
  // payment). Without JavaScript, a plain order email link is offered.
  let action = "";
  const emails = [c.email, c.email2].filter(Boolean);
  if (x.availability !== "soldout" && x.availability !== "soon") {
    if (x.buyUrl) action = `<a class="button button-large" href="${e(x.buyUrl)}" rel="noopener" target="_blank">${e(t.shop.buy)}</a>`;
    else if (emails.length) {
      const mail = `mailto:${emails.map(e).join(",")}?subject=${encodeURIComponent(`${t.shop.orderSubject}: ${x.title}`)}`;
      action = `<form class="add-form" data-add-to-order data-slug="${e(x.slug)}" data-title="${e(x.title)}" data-price="${x.price === null ? "" : x.price}" data-currency="${e(x.currency)}" data-price-abroad="${x.priceAbroad === null ? "" : x.priceAbroad}" data-currency-abroad="${e(x.currencyAbroad)}" data-ships="${e(x.shipsTo)}" hidden>${x.variants.map((v, i) => `
            <label class="field"><span>${e(v.name)}</span><select name="opt${i}" data-option="${e(v.name)}">${v.values.map((val) => `<option>${e(val)}</option>`).join("")}</select></label>`).join("")}
            <label class="field field-qty"><span>${e(t.shop.quantity)}</span><input type="number" name="qty" min="1" max="99" value="1" inputmode="numeric"></label>
            <button type="submit" class="button button-large">${e(t.shop.addToOrder)}</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </form>
          <noscript><a class="button button-large" href="${mail}">${e(t.shop.orderEmail)}</a></noscript>`;
    }
  }
  // The price box: price, VAT, shipping to each destination, and the total
  // with shipping in Israel when the currencies match. Only real settings are
  // shown (in the preview's example mode, example values are marked).
  const sh = data.shop;
  const row = (dt, dd, cls = "") => `<div${cls ? ` class="${cls}"` : ""}><dt>${e(dt)}</dt><dd>${dd}</dd></div>`;
  const rows = [];
  if (x.priceText) rows.push(row(t.shop.priceLabel, `<span${priceAttrs(x.price, x.currency, x.priceFrom)}>${x.priceFrom ? fromPrefix(ctx) : ""}${e(x.priceText)}</span>`));
  if (x.priceAbroadText) rows.push(row(t.shop.priceAbroad, `<span${priceAttrs(x.priceAbroad, x.currencyAbroad, false)}>${e(x.priceAbroadText)}</span>`));
  let vatAmount = 0;
  if (sh.vat && x.price !== null) {
    const v = sh.vat;
    if (v.mode === "added") vatAmount = Math.round(x.price * v.rate) / 100;
    const text = v.mode === "included" ? t.shop.vatIncluded : v.mode === "added" ? `${t.shop.vatAdded}: ${e(money(ctx, vatAmount, x.currency))}` : t.shop.vatNone;
    rows.push(row(`${t.shop.vat}${v.mode !== "none" ? ` (${v.rate}%)` : ""}`, `${v.mode === "added" ? text : e(text)}${exampleTag(ctx, v.example)}`));
  }
  if (x.shipsTo === "digital") rows.push(row(t.shop.shippingLine, e(t.shop.noShipping)));
  else {
    if (sh.shipIsrael || sh.shippingIsrael) rows.push(row(t.shop.shippingIsrael, [sh.shipIsrael && `<span${priceAttrs(sh.shipIsrael.amount, sh.shipIsrael.currency, false)}>${e(sh.shipIsrael.text)}</span>${exampleTag(ctx, sh.shipIsrael.example)}`, sh.shipIsrael && sh.freeIsraelFrom !== null && `<span class="ship-note">${e(t.shop.freeFrom.replace("{amount}", money(ctx, sh.freeIsraelFrom, sh.shipIsrael.currency)))}</span>`, sh.shippingIsrael && `<span class="ship-note">${e(sh.shippingIsrael)}</span>`].filter(Boolean).join(" ")));
    if (x.shipsTo === "worldwide" && (sh.shipAbroad || sh.shippingAbroad)) rows.push(row(t.shop.shippingAbroad, [sh.shipAbroad && `<span${priceAttrs(sh.shipAbroad.amount, sh.shipAbroad.currency, false)}>${e(sh.shipAbroad.text)}</span>${exampleTag(ctx, sh.shipAbroad.example)}`, sh.shippingAbroad && `<span class="ship-note">${e(sh.shippingAbroad)}</span>`].filter(Boolean).join(" ")));
    if (x.shipsTo === "israel") rows.push(row(t.shop.shippingAbroad, e(t.shop.notAbroad)));
  }
  if (x.price !== null && !x.priceFrom) {
    const ship = x.shipsTo === "digital" ? { amount: 0, currency: x.currency } : sh.shipIsrael;
    if (ship && ship.currency === x.currency) {
      const free = x.shipsTo !== "digital" && sh.freeIsraelFrom !== null && x.price + vatAmount >= sh.freeIsraelFrom;
      const total = x.price + vatAmount + (free ? 0 : ship.amount);
      rows.push(row(x.shipsTo === "digital" ? t.shop.totalPay : t.shop.totalIsrael, `<strong${priceAttrs(total, x.currency, false)}>${e(money(ctx, total, x.currency))}</strong>`, "buy-total"));
    }
  }
  const slides = x.images.map((im, i) => `
            <a class="product-slide${i === 0 ? " is-active" : ""}" href="${ctx.assetBase}${e(im.full || im.src)}" data-viewer data-slide="${i}" aria-label="${e(`${t.work.openImage}: ${im.alt}`)}">${img(ctx, im, { sizes: "(max-width: 900px) 100vw, 55vw", attrs: i === 0 ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"' })}</a>`).join("");
  const thumbs = x.images.length > 1 ? `
          <ul class="product-thumbs" aria-label="${e(t.shop.photos)}">${x.images.map((im, i) => `
            <li><button type="button" data-thumb="${i}" aria-label="${e(t.shop.photo.replace("{n}", i + 1))}"${i === 0 ? ' aria-current="true"' : ""}>${img(ctx, im, { sizes: "96px" })}</button></li>`).join("")}
          </ul>` : "";
  const sub = [x.category && x.category.name, x.type !== "physical" && t.shop.types[x.type], t.shop.shipsTo[x.shipsTo]].filter(Boolean);
  return layout(ctx, {
    edits: [[t.edit.thisProduct, ed.product(x.slug)], [t.edit.shopSettings, ed.shop], [t.edit.newProduct, ed.newProduct]],
    title: x.seoTitle || pageTitle(ctx, x.title),
    description: x.seoDescription || data.seoDescription,
    image: x.thumb,
    current: "shop",
    viewer: true,
    shopScript: true,
    noindex: x.example,
    main: `
    <article class="page product-page">
      <p class="crumb shop-crumb"><a href="${link("shop/")}">${e(t.shop.title)}</a>${orderLink(ctx)}</p>
      <div class="product-layout">
        <div class="product-photos">
          <div class="product-stage">${slides}
          </div>${thumbs}
        </div>
        <div class="product-info">${x.example ? `
          <p class="example-badge">${e(t.shop.exampleBadge)}</p>` : ""}
          <h1 class="page-title product-title">${e(x.title)}</h1>
          <p class="product-sub">${sub.map(e).join(" · ")}</p>
          <div class="buy-box">${x.priceText ? `
            <p class="buy-price"><span${priceAttrs(x.price, x.currency, x.priceFrom)}>${x.priceFrom ? fromPrefix(ctx) : ""}${e(x.priceText)}</span>${vatNote(ctx)}</p>` : ""}
            <p class="buy-availability is-${e(x.availability)}">${e(t.shop.availability[x.availability])}</p>${x.priceText ? currencyPicker(ctx) : ""}${action ? `
            <div class="product-action">${action}</div>` : ""}${rows.length ? `
            <dl class="buy-rows">${rows.join("")}</dl>` : ""}
          </div>${x.description ? `
          <div class="prose product-description">${md(x.description)}</div>` : ""}${x.details.length || sh.returns ? `
          <div class="product-more">${x.details.map((d) => `
            <details><summary>${e(d.title)}</summary><div class="prose">${md(d.text)}</div></details>`).join("")}${sh.returns ? `
            <details><summary>${e(t.shop.returnsTitle)}</summary><div class="prose">${md(sh.returns)}</div></details>` : ""}
          </div>` : ""}${x.variants.length ? `
          <dl class="details product-variants">${x.variants.map((v) => `<div><dt>${e(v.name)}</dt><dd>${v.values.map(e).join(" · ")}</dd></div>`).join("")}</dl>` : ""}${x.projects.length ? `
          <p class="product-projects">${e(t.shop.fromProject)}: ${x.projects.map((p) => `<a href="${link(`work/${p.slug}/`)}">${e(p.title)}</a>`).join(", ")}</p>` : ""}
        </div>
      </div>
    </article>`,
  });
}

// The visitor's order (kept in their own browser until sent). Sending opens
// an order email to the studio; nothing is charged on the site.
function order(ctx) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const emails = [data.contact.email, data.contact.email2].filter(Boolean);
  return layout(ctx, {
    edits: [[t.edit.shopSettings, ed.shop]],
    title: pageTitle(ctx, t.shop.orderTitle),
    description: t.shop.orderTitle,
    current: "shop",
    shopScript: true,
    noindex: true,
    main: `
    <div class="page order-page">
      <p class="crumb"><a href="${link("shop/")}">${e(t.shop.continue)}</a></p>
      <header class="page-head"><h1 class="page-title">${e(t.shop.orderTitle)}</h1></header>
      <noscript><p class="muted">${e(t.community.noscript)}</p></noscript>
      <div data-order hidden>
        <p class="shop-empty" data-order-empty hidden>${e(t.shop.orderEmpty)}</p>
        <ol class="order-items" data-order-items></ol>
        <form class="cform order-form" data-order-form novalidate hidden>
          <div class="order-summary" aria-labelledby="summary-title">
            <h2 id="summary-title" class="section-label">${e(t.shop.summary)}</h2>
            <dl class="buy-rows" data-order-lines></dl>
            <p class="order-total" data-order-total aria-live="polite"></p>
          </div>${currencyPicker(ctx)}
          <fieldset class="cform-type">
            <legend>${e(t.shop.destination)}</legend>
            <label><input type="radio" name="dest" value="israel" checked> ${e(t.shop.israel)}</label>
            <label><input type="radio" name="dest" value="abroad"> ${e(t.shop.abroad)}</label>
          </fieldset>
          <label class="field"><span>${e(t.shop.nameLabel)}</span><input name="name" maxlength="80" autocomplete="name" required></label>
          <label class="field"><span>${e(t.shop.notesLabel)}</span><textarea name="notes" rows="3" maxlength="1000"></textarea></label>
          <p class="form-note">${e(t.shop.sendNote)}</p>
          <button type="submit" class="button button-large"${emails.length ? "" : " disabled"}>${e(t.shop.sendOrder)}</button>
          <p class="form-status" role="status" aria-live="polite"></p>
        </form>${data.shop.payments.length ? `
        <section class="pay-box" data-pay hidden aria-labelledby="pay-title">
          <h2 id="pay-title" class="section-label">${e(t.shop.payTitle)}</h2>
          <p class="form-note">${e(t.shop.payIntro)}</p>
          <p class="pay-amount" data-pay-amount></p>
          <ul class="pay-list" data-pay-list></ul>
        </section>` : ""}
      </div>
    </div>`,
  });
}

function customPage(ctx, p) {
  return layout(ctx, {
    edits: [[ctx.t.edit.page, ed.page(p.slug)]],
    title: pageTitle(ctx, p.title),
    description: p.description || ctx.data.seoDescription,
    current: `page:${p.slug}`,
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(p.title)}</h1></header>
      <div class="prose prose-large">${md(p.body)}</div>
    </div>`,
  });
}

// One bilingual 404 page for GitHub Pages. Its address is unknown in
// advance, so it links with full addresses.
function notFound(site, en, he, preview) {
  const file = preview ? "index.html" : "";
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${e(en.notFound.title)} — BubaPix</title>
  <link rel="stylesheet" href="${site.url}css/fonts.css">
  <link rel="stylesheet" href="${site.url}css/styles.css">
</head>
<body>
  <main class="page not-found">
    <section>
      <h1 class="page-title">${e(en.notFound.title)}</h1>
      <p class="lede">${e(en.notFound.text)}</p>
      <p><a class="text-link" href="${site.url}${file}">${e(en.notFound.home)}</a></p>
    </section>
    <section lang="he" dir="rtl">
      <h2 class="page-title">${e(he.notFound.title)}</h2>
      <p class="lede">${e(he.notFound.text)}</p>
      <p><a class="text-link" href="${site.url}he/${file}">${e(he.notFound.home)}</a></p>
    </section>
  </main>
</body>
</html>
`;
}

module.exports = { usedRatios, freeRules, manage, shop, product, order, home, work, project, services, about, testimonials, contact, ideas, privacy, accessibility, customPage, notFound };

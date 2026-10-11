// Page renderers for the BubaPix site (redesign v2, multi-page).
// build.js calls these once per page and language. Visible interface labels
// come from src/i18n/<lang>.json; everything else comes from content/*.

const md = require("./markdown.js");

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

function tile(ctx, p, { sizes, eager = false } = {}) {
  const link = makeLink(ctx);
  const media = p.cover
    ? img(ctx, p.cover, { sizes, attrs: eager ? 'decoding="async"' : 'loading="lazy" decoding="async"' })
    : `<span class="tile-empty">${e(ctx.t.work.imageComing)}</span>`;
  const cats = p.categories.map((c) => c.name).join(", ");
  return `<a class="tile" href="${link(`work/${p.slug}/`)}" data-categories="${e(p.categories.map((c) => c.slug).join(" "))}">
          <span class="tile-media">${media}</span>
          <span class="tile-title">${e(p.title)}</span>${cats ? `
          <span class="tile-meta">${e(cats)}</span>` : ""}
        </a>`;
}

function layout(ctx, { title, description, image, main, current = "" }) {
  const { t, lang, dir, site, data } = ctx;
  const link = makeLink(ctx);
  const otherHref = ctx.otherBase + ctx.path + (ctx.preview ? "index.html" : "") + (lang === "he" ? "?lang=en" : "");
  const otherLang = lang === "he" ? "en" : "he";
  const absUrl = (l) => site.url + (l === "he" ? "he/" : "") + ctx.path;
  const ogImage = image ? site.url + image.src : data.hero ? site.url + data.hero.src : site.url + "assets/brand/bubapix-logo.jpg";

  const nav = [
    ["work/", t.nav.work, "work"],
    ["services/", t.nav.services, "services"],
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
  const redirect =
    lang === "en"
      ? `<script>try{if(localStorage.getItem("bubapix-lang")==="he"&&!/[?&]lang=en\\b/.test(location.search)){location.replace(${JSON.stringify(ctx.otherBase + ctx.path + (ctx.preview ? "index.html" : ""))}+location.hash)}}catch(e){}</script>`
      : "";

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${redirect}
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}">
  <link rel="canonical" href="${absUrl(lang)}">
  <link rel="alternate" hreflang="en" href="${absUrl("en")}">
  <link rel="alternate" hreflang="he" href="${absUrl("he")}">
  <link rel="alternate" hreflang="x-default" href="${absUrl("en")}">
  <meta name="theme-color" content="#f0eee2">
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&family=Heebo:wght@400..700&display=swap">
  <script>document.documentElement.classList.add("js");</script>
  <link rel="stylesheet" href="${ctx.assetBase}css/styles.css">
  <script src="${ctx.assetBase}js/main.js" defer></script>${site.analyticsHead ? `
  ${site.analyticsHead}` : ""}
</head>
<body>
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

  <footer class="site-footer">
    <nav class="footer-nav" aria-label="${e(t.a11y.footerNav)}">
      <ul>
        <li><a href="${link("")}">${e(t.nav.home)}</a></li>
        ${nav.map(([path, label]) => `<li><a href="${link(path)}">${e(label)}</a></li>`).join("\n        ")}${footerPages.map((p) => `
        <li><a href="${link(`pages/${p.slug}/`)}">${e(p.title)}</a></li>`).join("")}
      </ul>
    </nav>
    <div class="footer-meta">
      ${data.contact.email ? `<a class="footer-email" href="mailto:${e(data.contact.email)}">${e(data.contact.email)}</a>` : ""}
      <a class="lang-switch" href="${otherHref}" hreflang="${otherLang}" lang="${otherLang}" data-lang="${otherLang}">${e(t.nav.switchLabel)}</a>
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> BubaPix</p>
      <a href="#main">${e(t.footer.top)}</a>
    </div>
  </footer>
</body>
</html>
`;
}

const pageTitle = (ctx, title) => `${title} — ${ctx.t.meta.titleSuffix}`;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function home(ctx) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const featured = data.projects.filter((p) => p.featured);
  const shown = featured.length ? featured : data.projects;

  const hero = data.hero
    ? `
    <section class="hero" aria-label="${e(data.tagline || "BubaPix")}">
      <figure class="hero-frame">${img(ctx, data.hero, { attrs: 'fetchpriority="high" decoding="async"' })}</figure>${data.tagline ? `
      <p class="tagline">${e(data.tagline)}</p>` : ""}
    </section>`
    : "";

  const work = shown.length
    ? `
    <section class="section" aria-labelledby="selected-title">
      <div class="section-head">
        <h2 id="selected-title" class="section-label">${e(t.home.selectedWork)}</h2>
        <a class="text-link" href="${link("work/")}">${e(t.home.allWork)}</a>
      </div>
      <div class="mosaic">
        ${shown.map((p, i) => tile(ctx, p, { sizes: "(max-width: 860px) 100vw, 60vw", eager: i === 0 && !data.hero })).join("\n        ")}
      </div>
    </section>`
    : "";

  const intro = data.intro
    ? `
    <section class="section intro" aria-label="${e(t.nav.about)}">
      <p class="intro-text">${e(data.intro)}</p>
      <a class="text-link" href="${link("about/")}">${e(t.home.aboutLink)}</a>
    </section>`
    : "";

  return layout(ctx, {
    title: t.meta.homeTitle,
    description: data.seoDescription || data.intro,
    main: `    <h1 class="visually-hidden">BubaPix</h1>${hero}${work}${intro}`,
  });
}

function work(ctx) {
  const { t, data } = ctx;
  const used = data.categories.filter((c) => data.projects.some((p) => p.categories.some((pc) => pc.slug === c.slug)));
  const filters = used.length > 1 || (used.length === 1 && data.projects.some((p) => !p.categories.length))
    ? `
      <div class="filters" role="group" aria-label="${e(t.a11y.filterLabel)}" hidden>
        <button type="button" class="filter" data-filter="" aria-pressed="true">${e(t.work.all)}</button>${used.map((c) => `
        <button type="button" class="filter" data-filter="${e(c.slug)}" aria-pressed="false">${e(c.name)}</button>`).join("")}
      </div>`
    : "";
  const grid = data.projects.length
    ? `
      <div class="mosaic mosaic-work">
        ${data.projects.map((p) => tile(ctx, p, { sizes: "(max-width: 860px) 100vw, 50vw" })).join("\n        ")}
      </div>`
    : `<p class="muted">${e(t.work.empty)}</p>`;
  return layout(ctx, {
    title: pageTitle(ctx, t.work.title),
    description: data.seoDescription,
    current: "work",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.work.title)}</h1></header>${filters}${grid}
    </div>`,
  });
}

function videoBlock(ctx, p) {
  const { t } = ctx;
  if (p.video && p.video.kind === "youtube") {
    return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${e(p.video.id)}" title="${e(p.title)} — ${e(t.work.video)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  }
  if (p.video && p.video.kind === "vimeo") {
    return `<div class="video"><iframe src="https://player.vimeo.com/video/${e(p.video.id)}?dnt=1" title="${e(p.title)} — ${e(t.work.video)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if (p.videoFile) {
    return `<div class="video"><video controls preload="metadata" playsinline${p.cover ? ` poster="${ctx.assetBase}${e(p.cover.src)}"` : ""}><source src="${ctx.assetBase}${e(p.videoFile)}" type="video/mp4"></video></div>`;
  }
  return "";
}

function project(ctx, p, prev, next) {
  const { t } = ctx;
  const link = makeLink(ctx);
  const cats = p.categories.map((c) => c.name).join(", ");
  const description = md(p.description);
  const details = p.details.length
    ? `<dl class="details">${p.details.map((d) => `<div><dt>${e(d.label)}</dt><dd>${e(d.value)}</dd></div>`).join("")}</dl>`
    : "";
  const video = videoBlock(ctx, p);
  return layout(ctx, {
    title: pageTitle(ctx, p.title),
    description: p.text || ctx.data.seoDescription,
    image: p.cover,
    current: "work",
    main: `
    <article class="page project">
      <header class="page-head">
        <p class="crumb"><a href="${link("work/")}">${e(t.work.back)}</a></p>
        <h1 class="page-title">${e(p.title)}</h1>${cats ? `
        <p class="project-meta">${e(cats)}</p>` : ""}${p.text ? `
        <p class="lede">${e(p.text)}</p>` : ""}
      </header>
      <figure class="project-cover">${p.cover ? img(ctx, p.cover, { sizes: "(max-width: 1440px) 100vw, 1440px", attrs: 'fetchpriority="high" decoding="async"' }) : `<span class="tile-empty">${e(t.work.imageComing)}</span>`}</figure>${video ? `
      <section class="project-section" aria-label="${e(t.work.video)}">${video}</section>` : ""}${description || details ? `
      <section class="project-section project-body">
        <div class="prose">${description}</div>${details}
      </section>` : ""}${p.gallery.length ? `
      <section class="project-section" aria-label="${e(t.work.gallery)}">
        <ul class="gallery">${p.gallery.map((g) => `
          <li>${img(ctx, g, { sizes: "(max-width: 860px) 100vw, 50vw" })}</li>`).join("")}
        </ul>
      </section>` : ""}
      <nav class="pager" aria-label="${e(t.work.title)}">
        ${prev ? `<a class="pager-prev" href="${link(`work/${prev.slug}/`)}"><span>${e(t.work.previous)}</span>${e(prev.title)}</a>` : "<span></span>"}
        ${next ? `<a class="pager-next" href="${link(`work/${next.slug}/`)}"><span>${e(t.work.next)}</span>${e(next.title)}</a>` : "<span></span>"}
      </nav>
    </article>`,
  });
}

function services(ctx) {
  const { t, data } = ctx;
  const s = data.services;
  return layout(ctx, {
    title: pageTitle(ctx, t.services.title),
    description: s.intro || data.seoDescription,
    current: "services",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.services.title)}</h1>${s.intro ? `
        <p class="lede">${e(s.intro)}</p>` : ""}</header>
      <ul class="service-list">${s.items.map((x) => `
        <li><h2>${e(x.name)}</h2>${x.text ? `<p>${e(x.text)}</p>` : ""}</li>`).join("")}
      </ul>${s.process.length ? `
      <section class="section-inner" aria-labelledby="process-title">
        <h2 id="process-title" class="section-label">${e(s.processTitle)}</h2>
        <ol class="steps">${s.process.map((x, i) => `
          <li><span class="step-num">${i + 1}</span><h3>${e(x.name)}</h3>${x.text ? `<p>${e(x.text)}</p>` : ""}</li>`).join("")}
        </ol>
      </section>` : ""}
    </div>`,
  });
}

function about(ctx) {
  const { t, data } = ctx;
  const a = data.about;
  return layout(ctx, {
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
    c.email && [t.contact.email, `<a class="contact-link" href="mailto:${e(c.email)}">${e(c.email)}</a>`],
    c.phone && [t.contact.phone, `<a class="contact-link" href="tel:${e(c.phone.replace(/[^\d+]/g, ""))}">${e(c.phone)}</a>`],
    c.location && [t.contact.location, `<span>${e(c.location)}</span>`],
  ].filter(Boolean);
  const social = c.social.length
    ? `<div><dt>${e(t.contact.social)}</dt><dd><ul class="social">${c.social.map((s) => `<li><a href="${e(s.url)}" rel="noopener" target="_blank">${e(s.label)}</a></li>`).join("")}</ul></dd></div>`
    : "";
  return layout(ctx, {
    title: pageTitle(ctx, t.contact.title),
    description: c.intro || data.seoDescription,
    current: "contact",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.contact.title)}</h1>${c.intro ? `
        <p class="lede">${e(c.intro)}</p>` : ""}</header>
      ${rows.length || social
        ? `<dl class="contact-list">${rows.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${v}</dd></div>`).join("")}${social}</dl>`
        : `<p class="muted">${e(t.contact.pending)}</p>`}
    </div>`,
  });
}

function customPage(ctx, p) {
  return layout(ctx, {
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
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&family=Heebo:wght@400..700&display=swap">
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

module.exports = { home, work, project, services, about, testimonials, contact, customPage, notFound };

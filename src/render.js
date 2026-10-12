// Page renderers for the BubaPix site (redesign v2, multi-page).
// build.js calls these once per page and language. Visible interface labels
// come from src/i18n/<lang>.json; everything else comes from content/*.

const crypto = require("crypto");
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

// ---------------------------------------------------------------------------
// Galleries: pictures are shown whole (never cropped). Rows are "justified":
// each picture's width share matches its proportions, so every row lines up.
// The proportions become small CSS classes in css/gallery.css (see build.js).
// ---------------------------------------------------------------------------
const usedRatios = new Set();
function ratioClass(im) {
  const r = im.w && im.h ? Math.round((im.w / im.h) * 100) : 150;
  const clamped = Math.min(400, Math.max(40, r));
  usedRatios.add(clamped);
  return { cls: `ar-${clamped}`, ratio: clamped / 100 };
}

// One gallery picture. href: where it leads (project page or full image).
// caption: { title, note } or null. lead: shown alone, full width.
function galleryItem(ctx, im, { href = "", label = "", caption = null, lead = false, eager = false, viewer = false, sizes } = {}) {
  const { cls, ratio } = ratioClass(im);
  const isLead = lead && ratio >= 1.2;
  const sz = sizes || (isLead ? "(max-width: 1440px) 100vw, 1440px" : "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 40vw");
  const picture = `<span class="jg-media">${img(ctx, im, { sizes: sz, attrs: eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"' })}</span>`;
  const capInner = caption && (caption.title || caption.note)
    ? `${caption.title ? `<span class="jg-title">${e(caption.title)}</span>` : ""}${caption.note ? `<span class="jg-note">${e(caption.note)}</span>` : ""}`
    : "";
  const classes = `jg-item ${cls}${isLead ? " is-lead" : ""}`;
  if (!href) {
    return `<figure class="${classes}">${picture}${capInner ? `<figcaption class="jg-caption">${capInner}</figcaption>` : ""}</figure>`;
  }
  return `<a class="${classes}" href="${href}"${label ? ` aria-label="${e(label)}"` : ""}${viewer ? " data-viewer" : ""}>${picture}${capInner ? `<span class="jg-caption">${capInner}</span>` : ""}</a>`;
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
function csp(ctx, inlineScripts) {
  const hashes = inlineScripts.map((code) => `'sha256-${crypto.createHash("sha256").update(code).digest("base64")}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    // Preview builds are viewed on raw.githack.com, which serves pages
    // itself but REDIRECTS images and videos to raw.githubusercontent.com.
    // Only preview builds allow that address; the live site stays 'self'.
    `img-src 'self' data:${ctx.preview ? " https://raw.githubusercontent.com" : ""}`,
    `media-src 'self'${ctx.preview ? " https://raw.githubusercontent.com" : ""}`,
    `connect-src ${ctx.site.community ? ctx.site.community.url : "'none'"}`,
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

function layout(ctx, { title, description, image, main, current = "", community = false, viewer = false }) {
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
    : `\n  <meta http-equiv="Content-Security-Policy" content="${csp(ctx, [redirectCode, jsFlag].filter(Boolean))}">`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${policy}
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
  <script>${jsFlag}</script>
  <link rel="stylesheet" href="${ctx.assetBase}css/styles.css">
  <link rel="stylesheet" href="${ctx.assetBase}css/gallery.css">
  <script src="${ctx.assetBase}js/main.js" defer></script>${withCommunity ? `
  ${communityData(ctx)}
  <script src="${ctx.assetBase}js/community.js" defer></script>` : ""}${site.analyticsHead ? `
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

  <footer class="site-footer">
    <nav class="footer-nav" aria-label="${e(t.a11y.footerNav)}">
      <ul>
        <li><a href="${link("")}">${e(t.nav.home)}</a></li>
        ${nav.map(([path, label]) => `<li><a href="${link(path)}">${e(label)}</a></li>`).join("\n        ")}${footerPages.map((p) => `
        <li><a href="${link(`pages/${p.slug}/`)}">${e(p.title)}</a></li>`).join("")}
${data.participation.ideas ? `
        <li><a href="${link("ideas/")}"${current === "ideas" ? ' aria-current="page"' : ""}>${e(t.nav.ideas)}</a></li>` : ""}${data.participation.any ? `
        <li><a href="${link("privacy/")}"${current === "privacy" ? ' aria-current="page"' : ""}>${e(t.nav.privacy)}</a></li>` : ""}
      </ul>
    </nav>
    ${data.contact.social.length ? `<ul class="footer-social" aria-label="${e(t.contact.social)}">${data.contact.social.map((x) => `<li><a href="${e(x.url)}" rel="noopener me" target="_blank">${e(x.label)}</a></li>`).join("")}</ul>` : ""}
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
  // Homepage pictures are for looking only: they do not open project pages
  // (projects are reached from the Work page).
  const items = data.homeGallery.map((g, i) =>
    galleryItem(ctx, g.image, {
      caption: g.caption,
      lead: i === 0,
      eager: i === 0,
    })
  );
  const work = items.length
    ? `
    <section class="section section-work" aria-labelledby="work-title">
      <h2 id="work-title" class="section-label">${e(t.home.workTitle)}</h2>
      ${gallery(items, "jg-home")}
    </section>`
    : "";
  const tagline = data.tagline ? `
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
  const canContact = !!(data.contact.email || data.contact.phone || data.participation.consult);
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
    title: t.meta.homeTitle,
    description: data.seoDescription || data.intro,
    main: `    <h1 class="visually-hidden">BubaPix</h1>${tagline}${showreel}${work}${services}${intro}${start}`,
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
  const items = data.projects.map((p) =>
    galleryItem(ctx, p.thumb, {
      href: link(`work/${p.slug}/`),
      label: p.title,
      caption: p.titleInGallery ? { title: p.name, note: p.categories.map((c) => c.name).join(", ") } : null,
    }).replace('<a class="jg-item', `<a data-categories="${e(p.categories.map((c) => c.slug).join(" "))}" class="jg-item`)
  );
  const grid = items.length ? gallery(items, "jg-work") : `<p class="muted">${e(t.work.empty)}</p>`;
  return layout(ctx, {
    title: pageTitle(ctx, t.work.title),
    description: data.seoDescription,
    current: "work",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.work.title)}</h1></header>${filters}
      ${grid}
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

// Pictures inside a project page: open in the image viewer.
function projectPictures(ctx, list) {
  return gallery(
    list.map((im) =>
      galleryItem(ctx, im, {
        href: ctx.assetBase + e(im.full || im.src),
        label: `${ctx.t.work.openImage}: ${im.alt}`,
        caption: im.caption !== "hidden" ? { title: im.title, note: im.note } : null,
        viewer: true,
      })
    ),
    "jg-project"
  );
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
  const cover = p.cover
    ? `
      <figure class="project-cover"><a href="${ctx.assetBase}${e(p.cover.full || p.cover.src)}" data-viewer aria-label="${e(`${t.work.openImage}: ${p.cover.alt}`)}">${img(ctx, p.cover, { sizes: "(max-width: 1440px) 100vw, 1440px", attrs: 'fetchpriority="high" decoding="async"' })}</a></figure>`
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
    title: p.seoTitle || pageTitle(ctx, p.title),
    description: p.seoDescription || p.text || ctx.data.seoDescription,
    image: p.thumb,
    current: "work",
    community: !!community,
    viewer: true,
    main: `
    <article class="page project">
      <header class="page-head">
        <p class="crumb"><a href="${link("work/")}">${e(t.work.back)}</a></p>
        <h1 class="${p.showTitle ? "page-title" : "visually-hidden"}">${e(p.title)}</h1>${cats ? `
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
  const { t } = ctx;
  return layout(ctx, {
    title: pageTitle(ctx, t.privacy.title),
    description: t.privacy.items[0],
    current: "privacy",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.privacy.title)}</h1></header>
      <div class="prose prose-large">
        <ul>${t.privacy.items.map((x) => `
          <li>${e(x)}</li>`).join("")}
        </ul>
        <p><a class="text-link" href="${makeLink(ctx)("contact/")}">${e(t.consult.title)}</a></p>
      </div>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------
// "From" before a price: "From ₪89" in English, "החל מ־89 ₪" in Hebrew (no space after the maqaf).
const fromPrefix = (ctx) => e(ctx.t.shop.from) + (/־$/.test(ctx.t.shop.from) ? "" : " ");

function productCard(ctx, x) {
  const link = makeLink(ctx);
  const { cls } = ratioClass(x.thumb);
  return `<a class="product-card" href="${link(`shop/${x.slug}/`)}">
          <span class="product-media">${img(ctx, x.thumb, { sizes: "(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 25vw" })}</span>
          <span class="product-name">${e(x.title)}</span>${x.priceText ? `
          <span class="product-price">${x.priceFrom ? fromPrefix(ctx) : ""}${e(x.priceText)}</span>` : ""}${x.availability !== "available" ? `
          <span class="product-badge">${e(ctx.t.shop.availability[x.availability])}</span>` : ""}
        </a>`;
}

function shop(ctx) {
  const { t, data } = ctx;
  const cats = data.shop.categories;
  const filters = cats.length > 1
    ? `
      <div class="filters" role="group" aria-label="${e(t.shop.title)}" hidden>
        <button type="button" class="filter" data-filter="" aria-pressed="true">${e(t.shop.all)}</button>${cats.map((c) => `
        <button type="button" class="filter" data-filter="${e(c.slug)}" aria-pressed="false">${e(c.name)}</button>`).join("")}
      </div>`
    : "";
  const grid = data.products.length
    ? `
      <div class="product-grid">
        ${data.products.map((x) => productCard(ctx, x).replace('<a class="product-card"', `<a data-categories="${e(x.category ? x.category.slug : "")}" class="product-card"`)).join("\n        ")}
      </div>`
    : `
      <p class="shop-empty">${e(t.shop.empty)}</p>`;
  return layout(ctx, {
    title: pageTitle(ctx, t.shop.title),
    description: data.shop.intro || data.seoDescription,
    current: "shop",
    main: `
    <div class="page">
      <header class="page-head"><h1 class="page-title">${e(t.shop.title)}</h1>${data.shop.intro ? `
        <p class="lede">${e(data.shop.intro)}</p>` : ""}</header>${filters}${grid}
    </div>`,
  });
}

function product(ctx, x) {
  const { t, data } = ctx;
  const link = makeLink(ctx);
  const c = data.contact;
  // The buy button never pretends: it opens the product's own buy link, or an
  // order email to the address on the Contact page. Without either, no button.
  let action = "";
  if (x.availability !== "soldout" && x.availability !== "soon") {
    if (x.buyUrl) action = `<a class="button button-large" href="${e(x.buyUrl)}" rel="noopener" target="_blank">${e(t.shop.buy)}</a>`;
    else if (c.email) action = `<a class="button button-large" href="mailto:${e(c.email)}?subject=${encodeURIComponent(`${t.shop.orderSubject}: ${x.title}`)}">${e(t.shop.orderEmail)}</a>`;
  }
  const pics = x.images.map((im, i) =>
    galleryItem(ctx, im, { href: ctx.assetBase + e(im.full || im.src), label: `${t.work.openImage}: ${im.alt}`, viewer: true, lead: i === 0, eager: i === 0 })
  );
  return layout(ctx, {
    title: x.seoTitle || pageTitle(ctx, x.title),
    description: x.seoDescription || data.seoDescription,
    image: x.thumb,
    current: "shop",
    viewer: true,
    main: `
    <article class="page product-page">
      <p class="crumb"><a href="${link("shop/")}">${e(t.shop.title)}</a></p>
      <div class="product-layout">
        <div class="product-photos">${gallery(pics, "jg-product")}</div>
        <div class="product-info">
          <h1 class="page-title">${e(x.title)}</h1>${x.priceText ? `
          <p class="product-price-large">${x.priceFrom ? fromPrefix(ctx) : ""}${e(x.priceText)}</p>` : ""}
          <p class="product-meta">${e(t.shop.availability[x.availability])}${x.category ? ` · ${e(x.category.name)}` : ""}${x.type !== "physical" ? ` · ${e(t.shop.types[x.type])}` : ""}</p>${x.description ? `
          <div class="prose">${md(x.description)}</div>` : ""}${x.variants.length ? `
          <dl class="details product-variants">${x.variants.map((v) => `<div><dt>${e(v.name)}</dt><dd>${v.values.map(e).join(" · ")}</dd></div>`).join("")}</dl>` : ""}${action ? `
          <p class="product-action">${action}</p>` : ""}${x.projects.length ? `
          <p class="product-projects">${e(t.shop.fromProject)}: ${x.projects.map((p) => `<a href="${link(`work/${p.slug}/`)}">${e(p.title)}</a>`).join(", ")}</p>` : ""}
        </div>
      </div>
    </article>`,
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

module.exports = { usedRatios, shop, product, home, work, project, services, about, testimonials, contact, ideas, privacy, customPage, notFound };

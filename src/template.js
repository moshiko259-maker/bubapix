// Page template for the BubaPix homepage (redesign v2).
// Called by build.js once per language.
//   t  interface labels from src/i18n/<lang>.json
//   c  content for this language, prepared by build.js from content/site.json
//      (hero image, tagline, about text, contact email, projects)

// Escape text before placing it in HTML.
function e(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = function render({ t, c, lang, dir, base, urls, other }) {
  const logo = `${base}assets/brand/bubapix-logo.jpg`; // original file, 989 x 902

  // The logo file has thin dark strips on its top and bottom edges
  // (screenshot borders). .logo-frame hides them with CSS; the file is untouched.
  const logoImg = (alt, cls, attrs = "") =>
    `<span class="logo-frame ${cls}"><img src="${logo}" alt="${e(alt)}" width="989" height="902" ${attrs}></span>`;

  // One image, at its own proportions (width/height read from the file).
  const img = (im, attrs = 'loading="lazy" decoding="async"') =>
    `<img src="${base}${e(im.src)}" alt="${e(im.alt)}"${im.w ? ` width="${im.w}" height="${im.h}"` : ""} ${attrs}>`;

  const cover = (p) =>
    p.cover
      ? `<div class="project-cover">${img(p.cover)}</div>`
      : `<div class="project-cover project-cover-empty"><span>${e(t.work.imageComing)}</span></div>`;

  const featured = c.featured
    .map(
      (p) => `
        <article class="project project-featured">
          ${cover(p)}
          <h3 class="project-title">${e(p.title)}</h3>${p.text ? `
          <p class="project-text">${e(p.text)}</p>` : ""}${p.gallery.length ? `
          <ul class="project-gallery">${p.gallery.map((g) => `
            <li>${img(g)}</li>`).join("")}
          </ul>` : ""}
        </article>`
    )
    .join("");

  const others = c.others.length
    ? `
      <ul class="gallery">${c.others
        .map(
          (p) => `
        <li class="project">
          ${cover(p)}
          <h3 class="project-title">${e(p.title)}</h3>
        </li>`
        )
        .join("")}
      </ul>`
    : "";

  const hero = c.hero
    ? `
    <section class="hero" aria-label="${e(c.tagline || "BubaPix")}">
      <figure class="hero-frame">
        ${img(c.hero, 'fetchpriority="high"')}
      </figure>${c.tagline ? `
      <p class="tagline">${e(c.tagline)}</p>` : ""}
    </section>`
    : "";

  const contact = c.email
    ? `<a class="contact-email" href="mailto:${e(c.email)}">${e(c.email)}</a>`
    : `<p class="pending">${e(t.contact.pending)}</p>`;

  // Remember the language a visitor picks, and send returning Hebrew
  // readers from the English root to /he/. Only runs on the English page.
  const redirect =
    lang === "en"
      ? `<script>try{if(localStorage.getItem("bubapix-lang")==="he"&&!/[?&]lang=en\\b/.test(location.search)){location.replace("he/"+location.hash)}}catch(e){}</script>`
      : "";

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${redirect}
  <title>${e(t.meta.title)}</title>
  <meta name="description" content="${e(c.about || t.meta.description)}">
  <link rel="canonical" href="${urls[lang]}">
  <link rel="alternate" hreflang="en" href="${urls.en}">
  <link rel="alternate" hreflang="he" href="${urls.he}">
  <link rel="alternate" hreflang="x-default" href="${urls.en}">
  <meta name="theme-color" content="#f7f6ef">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BubaPix">
  <meta property="og:title" content="${e(t.meta.title)}">
  <meta property="og:description" content="${e(c.about || t.meta.description)}">
  <meta property="og:url" content="${urls[lang]}">
  <meta property="og:locale" content="${t.meta.ogLocale}">
  <meta property="og:locale:alternate" content="${other.t.meta.ogLocale}">${c.hero ? `
  <meta property="og:image" content="${urls.en}${e(c.hero.src)}">` : ""}

  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml">

  <link rel="stylesheet" href="${ctx.assetBase}css/fonts.css">
${c.hero ? `
  <link rel="preload" as="image" href="${base}${e(c.hero.src)}">` : ""}
  <script>document.documentElement.classList.add("js");</script>
  <link rel="stylesheet" href="${base}css/styles.css">
  <script src="${base}js/main.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${e(t.a11y.skip)}</a>

  <header class="site-header">
    <a class="brand" href="./" aria-label="${e(t.a11y.home)}">${logoImg("", "logo-compact")}</a>
    <nav class="site-nav" aria-label="${e(t.a11y.mainNav)}">
      <ul class="menu">
        <li><a href="#work">${e(t.nav.work)}</a></li>
        <li><a href="#about">${e(t.nav.about)}</a></li>
        <li><a href="#contact">${e(t.nav.contact)}</a></li>
        <li><a class="lang-switch" href="${other.href}" hreflang="${other.lang}" lang="${other.lang}" title="${e(t.nav.switchTitle)}" data-lang="${other.lang}">${e(t.nav.switchLabel)}</a></li>
      </ul>
    </nav>
  </header>

  <main id="main">
    <h1 class="visually-hidden">BubaPix</h1>
${hero}

    <section id="work" class="section work" aria-labelledby="work-title">
      <h2 id="work-title" class="section-label">${e(t.work.workTitle)}</h2>
      <div class="featured">${featured}
      </div>${others}
    </section>

    <section id="about" class="section about" aria-labelledby="about-title">
      <h2 id="about-title" class="section-label">${e(t.nav.about)}</h2>
      <div class="about-body">
        ${c.about ? `<p class="about-text">${e(c.about)}</p>` : ""}
        ${logoImg(t.footer.logoAlt, "logo-full", 'loading="lazy" decoding="async"')}
      </div>
    </section>

    <section id="contact" class="section contact" aria-labelledby="contact-title">
      <h2 id="contact-title" class="section-label">${e(t.contact.title)}</h2>
      ${contact}
    </section>
  </main>

  <footer class="site-footer">
    <p>&copy; <span data-year>${new Date().getFullYear()}</span> BubaPix</p>
    <a class="lang-switch" href="${other.href}" hreflang="${other.lang}" lang="${other.lang}" data-lang="${other.lang}">${e(t.nav.switchLabel)}</a>
    <a href="#main">${e(t.footer.top)}</a>
  </footer>
</body>
</html>
`;
};

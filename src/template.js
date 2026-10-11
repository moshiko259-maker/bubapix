// Page template for the BubaPix homepage.
// Called by build.js once per language. All visible text comes from
// src/i18n/<lang>.json; nothing language-specific is hard-coded here.

const SCENES = [
  "dusk-sea",
  "northern-night",
  "desert-noon",
  "forest-morning",
  "second-sun",
  "snow-valley",
];

// Escape text before placing it in HTML.
function e(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scene(base, name) {
  return `${base}assets/scenes/${name}.svg`;
}

module.exports = function render({ t, lang, dir, base, urls, other, site }) {
  const email = site.contactEmail;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(t.final.emailSubject)}`
    : "";

  const heroScene = SCENES[0];

  const scriptButtons = SCENES.map(
    (s, i) => `
          <li>
            <button class="script-frame" type="button" data-scene="${s}" data-src="${scene(base, s)}" data-name="${e(t.scenes[s])}" aria-pressed="${i === 0}">
              <img src="${scene(base, s)}" alt="" width="160" height="90" loading="lazy" decoding="async">
              <span class="visually-hidden">${e(t.scenes[s])}</span>
            </button>
          </li>`
  ).join("");

  const workItems = t.work.items
    .map(
      (w, i) => `
        <li class="work-item work-item-${i + 1}">
          <figure>
            <div class="frame">
              <img src="${scene(base, w.scene)}" alt="${e(t.placeholder)}: ${e(t.scenes[w.scene])}" width="1600" height="900" loading="lazy" decoding="async">
              <span class="tag">${e(t.placeholder)}</span>
            </div>
            <figcaption>
              <span class="work-type">${e(w.type)}</span>
              <span class="work-title">${e(t.work.filmTitle)}</span>
            </figcaption>
          </figure>
        </li>`
    )
    .join("");

  const services = t.services.items
    .map(
      (s) => `
        <li>
          <h3>${e(s.name)}</h3>
          <p>${e(s.text)}</p>
        </li>`
    )
    .join("");

  const steps = t.process.steps
    .map(
      (s, i) => `
        <li class="step step-${i + 1}">
          <div class="step-frame" aria-hidden="true">
            <img src="${scene(base, "dusk-sea")}" alt="" width="1600" height="900" loading="lazy" decoding="async">
          </div>
          <div class="step-text">
            <h3><span class="step-num">${i + 1}</span> ${e(s.name)}</h3>
            <p>${e(s.text)}</p>
          </div>
        </li>`
    )
    .join("");

  const startAction = email
    ? `<a class="button button-light" href="${e(mailto)}">${e(t.final.cta)}</a>`
    : `<p class="pending">${e(t.final.pending)}</p>`;

  const footerContact = email
    ? `<a href="${e(mailto)}">${e(email)}</a>`
    : `<span>${e(t.footer.contactPending)}</span>`;

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
  <meta name="description" content="${e(t.meta.description)}">
  <link rel="canonical" href="${urls[lang]}">
  <link rel="alternate" hreflang="en" href="${urls.en}">
  <link rel="alternate" hreflang="he" href="${urls.he}">
  <link rel="alternate" hreflang="x-default" href="${urls.en}">
  <meta name="theme-color" content="#faf9f6">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BubaPix">
  <meta property="og:title" content="${e(t.meta.title)}">
  <meta property="og:description" content="${e(t.meta.description)}">
  <meta property="og:url" content="${urls[lang]}">
  <meta property="og:locale" content="${t.meta.ogLocale}">
  <meta property="og:locale:alternate" content="${other.t.meta.ogLocale}">

  <link rel="icon" href="${base}favicon.svg" type="image/svg+xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&family=Heebo:wght@400..700&display=swap">

  <link rel="preload" as="image" href="${scene(base, heroScene)}">
  <script>document.documentElement.classList.add("js");</script>
  <link rel="stylesheet" href="${base}css/styles.css">
  <script src="${base}js/main.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${e(t.a11y.skip)}</a>

  <header class="site-header">
    <a class="wordmark" href="./" aria-label="${e(t.a11y.home)}">BubaPix</a>

    <nav class="site-nav" aria-label="${e(t.a11y.mainNav)}">
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu" data-open="${e(t.a11y.menuOpen)}" data-close="${e(t.a11y.menuClose)}">${e(t.a11y.menuOpen)}</button>
      <ul class="menu" id="menu">
        <li><a href="#work">${e(t.nav.work)}</a></li>
        <li><a href="#services">${e(t.nav.services)}</a></li>
        <li><a href="#about">${e(t.nav.about)}</a></li>
        <li class="menu-lang"><a class="lang-switch" href="${other.href}" hreflang="${other.lang}" lang="${other.lang}" title="${e(t.nav.switchTitle)}" data-lang="${other.lang}">${e(t.nav.switchLabel)}</a></li>
        <li class="menu-cta"><a class="button button-dark nav-cta" href="#start">${e(t.nav.cta)}</a></li>
      </ul>
    </nav>
  </header>

  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-head">
        <h1 id="hero-title" class="hero-title">
          <span class="line">${e(t.hero.line1)}</span>
          <span class="line">${e(t.hero.line2)}</span>
        </h1>
        <div class="hero-side">
          <p class="hero-lede">${e(t.hero.lede)}</p>
          <div class="actions">
            <a class="button button-dark" href="#start">${e(t.hero.cta)}</a>
            <a class="text-link" href="#work">${e(t.hero.secondary)}</a>
          </div>
        </div>
      </div>

      <figure class="hero-frame">
        <div class="frame frame-wide">
          <img class="hero-still" src="${scene(base, heroScene)}" alt="${e(t.placeholder)}: ${e(t.scenes[heroScene])}" width="1600" height="900" fetchpriority="high">
          <span class="tag">${e(t.placeholder)}</span>
        </div>
        <figcaption>
          <span class="scene-name" aria-live="polite">${e(t.scenes[heroScene])}</span>
          <span class="scene-note">${e(t.hero.placeholderNote)}</span>
        </figcaption>
      </figure>

      <div class="script">
        <p class="script-label" id="script-label">${e(t.hero.scriptLabel)}</p>
        <ul class="script-strip" aria-labelledby="script-label">${scriptButtons}
        </ul>
      </div>
    </section>

    <section id="work" class="section work" aria-labelledby="work-title">
      <div class="section-head">
        <h2 id="work-title" class="section-title">${e(t.work.title)}</h2>
        <p class="section-intro">${e(t.work.intro)}</p>
      </div>
      <ul class="work-grid">${workItems}
      </ul>
    </section>

    <section id="services" class="section services" aria-labelledby="services-title">
      <h2 id="services-title" class="section-title">${e(t.services.title)}</h2>
      <ul class="service-list">${services}
      </ul>
    </section>

    <section id="process" class="section process" aria-labelledby="process-title">
      <div class="section-head">
        <h2 id="process-title" class="section-title">${e(t.process.title)}</h2>
        <p class="section-intro">${e(t.process.intro)}</p>
      </div>
      <ol class="steps">${steps}
      </ol>
    </section>

    <section id="about" class="section about" aria-labelledby="about-title">
      <h2 id="about-title" class="section-title">${e(t.about.title)}</h2>
      <div class="about-body">
        <p class="about-lead">${e(t.about.p1)}</p>
        <p>${e(t.about.p2)}</p>
      </div>
    </section>

    <section id="start" class="final" aria-labelledby="final-title">
      <img class="final-bg" src="${scene(base, "northern-night")}" alt="" width="1600" height="900" loading="lazy" decoding="async">
      <div class="final-inner">
        <h2 id="final-title" class="final-title">${e(t.final.title)}</h2>
        <p class="final-lede">${e(t.final.lede)}</p>
        ${startAction}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-brand">
      <a class="wordmark" href="./">BubaPix</a>
      <p>${e(t.footer.tagline)}</p>
    </div>
    <nav class="footer-col" aria-label="${e(t.a11y.footerNav)}">
      <h2>${e(t.footer.studio)}</h2>
      <ul>
        <li><a href="#work">${e(t.nav.work)}</a></li>
        <li><a href="#services">${e(t.nav.services)}</a></li>
        <li><a href="#about">${e(t.nav.about)}</a></li>
      </ul>
    </nav>
    <div class="footer-col">
      <h2>${e(t.footer.contact)}</h2>
      <p>${footerContact}</p>
    </div>
    <div class="footer-col">
      <h2>${e(t.footer.language)}</h2>
      <p><a class="lang-switch" href="${other.href}" hreflang="${other.lang}" lang="${other.lang}" data-lang="${other.lang}">${e(t.nav.switchLabel)}</a></p>
    </div>
    <div class="footer-base">
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${e(t.footer.rights)}</p>
      <p>${e(t.footer.artNote)}</p>
      <a href="#main">${e(t.footer.top)}</a>
    </div>
  </footer>
</body>
</html>
`;
};

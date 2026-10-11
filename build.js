#!/usr/bin/env node
// Builds the English and Hebrew homepages from one template.
//
//   node build.js
//
// Writes:  index.html     (English, served at /bubapix/)
//          he/index.html  (Hebrew,  served at /bubapix/he/)
//
// Edit the text in src/i18n/en.json and src/i18n/he.json, then run this again.

const fs = require("fs");
const path = require("path");
const render = require("./src/template.js");

// ---- Site settings -------------------------------------------------
const site = {
  // Full public address of the English homepage, ending with "/".
  // Change to "https://bubapix.com/" once the custom domain is connected.
  url: "https://moshiko259-maker.github.io/bubapix/",

  // Leave empty until the mailbox exists and has been tested.
  // While empty, the page says the contact address is being set up.
  contactEmail: "",
};
// --------------------------------------------------------------------

const root = __dirname;
const load = (lang) =>
  JSON.parse(fs.readFileSync(path.join(root, "src/i18n", lang + ".json"), "utf8"));

const en = load("en");
const he = load("he");

// Fail loudly if one language is missing a key the other has.
function shape(obj, prefix = "") {
  if (Array.isArray(obj)) {
    return [`${prefix}[${obj.length}]`, ...obj.flatMap((v, i) => shape(v, `${prefix}[${i}]`))];
  }
  if (obj && typeof obj === "object") {
    return Object.keys(obj).flatMap((k) => shape(obj[k], prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}
const a = new Set(shape(en));
const b = new Set(shape(he));
const missingInHe = [...a].filter((k) => !b.has(k));
const missingInEn = [...b].filter((k) => !a.has(k));
if (missingInHe.length || missingInEn.length) {
  if (missingInHe.length) console.error("Missing in he.json:", missingInHe.join(", "));
  if (missingInEn.length) console.error("Missing in en.json:", missingInEn.join(", "));
  process.exit(1);
}

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
  const html = render({ ...p, urls, site });
  const out = path.join(root, p.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${p.file} (${(html.length / 1024).toFixed(1)} KB)`);
}

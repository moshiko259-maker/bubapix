// Downloads current exchange rates (free, no key) so the shop can show
// APPROXIMATE prices in the visitor's chosen currency. Source: the European
// Central Bank reference rates, served by frankfurter.dev.
//
// Run by the build workflow before the site is built. If the download fails,
// the previous data/rates.json (or the manual rates in the admin) is kept, and
// the build continues.
"use strict";
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data", "rates.json");
const URL = "https://api.frankfurter.dev/v1/latest?base=USD";

(async () => {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    const rates = { USD: 1 };
    for (const [code, v] of Object.entries(j.rates || {})) {
      if (/^[A-Z]{3}$/.test(code) && typeof v === "number" && isFinite(v) && v > 0) rates[code] = v;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date || "") || Object.keys(rates).length < 5) throw new Error("unexpected answer");
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ source: "European Central Bank (frankfurter.dev)", date: j.date, base: "USD", rates }, null, 2) + "\n");
    console.log(`Exchange rates of ${j.date} saved (${Object.keys(rates).length} currencies).`);
  } catch (err) {
    console.log(`Exchange rates not updated (${err.message}); keeping the previous ones.`);
  }
})();

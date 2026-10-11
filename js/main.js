/* ==========================================================
   BubaPix — homepage script (redesign v2)
   1. Opening moment for the main image.
   2. Language switch: remembers the choice and keeps the
      section you were reading.
   No libraries. The page works without this file.
   ========================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var KEY = "bubapix-lang";

  function store(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked */ }
  }

  // ---------- 1. Opening moment ----------
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add("is-loaded"); });
  });

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---------- 2. Language ----------
  // Arriving on English with ?lang=en means the visitor chose English.
  if (/[?&]lang=en\b/.test(location.search)) {
    store("en");
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".lang-switch"), function (a) {
    a.addEventListener("click", function (e) {
      store(a.getAttribute("data-lang"));
      // Keep the section the visitor is reading.
      if (location.hash) {
        e.preventDefault();
        location.href = a.getAttribute("href") + location.hash;
      }
    });
  });

  // Visiting a language version counts as choosing it.
  store(root.lang === "he" ? "he" : "en");
})();

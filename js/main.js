/* ==========================================================
   BubaPix — homepage script (redesign v1)
   1. Opening moment for the hero frame.
   2. Small-screen menu.
   3. Language switch: remembers the choice and keeps the
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

  // ---------- 2. Small-screen menu ----------
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("menu");
  var small = window.matchMedia("(max-width: 860px)");

  function setOpen(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = toggle.getAttribute(open ? "data-close" : "data-open");
    menu.hidden = !open;
  }

  function syncMenu() {
    if (!menu) return;
    if (small.matches) setOpen(false);
    else { menu.hidden = false; if (toggle) toggle.setAttribute("aria-expanded", "false"); }
  }

  if (toggle && menu) {
    syncMenu();
    if (small.addEventListener) small.addEventListener("change", syncMenu);
    else if (small.addListener) small.addListener(syncMenu);

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (small.matches && e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (small.matches && !e.target.closest(".site-nav")) setOpen(false);
    });
  }

  // ---------- 3. Language ----------
  // Arriving on English with ?lang=en means the visitor chose English.
  if (/[?&]lang=en\b/.test(location.search)) {
    store("en");
    if (history.replaceState) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".lang-switch"), function (a) {
    a.addEventListener("click", function (e) {
      var lang = a.getAttribute("data-lang");
      store(lang);
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

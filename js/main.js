/* ==========================================================
   BubaPix — site script (redesign v2)
   1. Opening moment for the main image.
   2. Small-screen menu.
   3. Work filter by category.
   4. Language switch: remembers the choice and keeps the
      section you were reading.
   No libraries. Every page works without this file.
   ========================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var KEY = "bubapix-lang";
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

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
  var small = window.matchMedia("(max-width: 760px)");

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = toggle.getAttribute(open ? "data-close" : "data-open");
    menu.hidden = !open;
  }
  function sync() {
    toggle.hidden = !small.matches;
    if (small.matches) setOpen(false);
    else { menu.hidden = false; toggle.setAttribute("aria-expanded", "false"); }
  }
  if (toggle && menu) {
    sync();
    if (small.addEventListener) small.addEventListener("change", sync);
    else if (small.addListener) small.addListener(sync);
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
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

  // ---------- 3. Work filter ----------
  var filters = document.querySelector(".filters");
  if (filters) {
    var buttons = filters.querySelectorAll(".filter");
    var tiles = document.querySelectorAll(".mosaic-work .tile");
    var apply = function (slug) {
      each(buttons, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === slug)); });
      each(tiles, function (tile) {
        var cats = (tile.getAttribute("data-categories") || "").split(" ");
        tile.hidden = !!slug && cats.indexOf(slug) === -1;
      });
    };
    each(buttons, function (b) {
      b.addEventListener("click", function () {
        var slug = b.getAttribute("data-filter");
        apply(slug);
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search + (slug ? "#" + slug : ""));
        }
      });
    });
    filters.hidden = false;
    var start = location.hash.slice(1);
    if (start && filters.querySelector('[data-filter="' + start.replace(/[^a-z0-9-]/g, "") + '"]')) apply(start);
  }

  // ---------- 4. Language ----------
  if (/[?&]lang=en\b/.test(location.search)) {
    store("en");
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.hash);
  }
  each(document.querySelectorAll(".lang-switch"), function (a) {
    a.addEventListener("click", function (e) {
      store(a.getAttribute("data-lang"));
      if (location.hash) {
        e.preventDefault();
        location.href = a.getAttribute("href") + location.hash;
      }
    });
  });
  store(root.lang === "he" ? "he" : "en");
})();

/* ==========================================================
   BubaPix — site script (redesign v2)
   1. Opening moment for the main image.
   2. Small-screen menu.
   3. Work filter by category.
   4. Language switch: remembers the choice and keeps the
      section you were reading.
   5. Image viewer on project pages: a picture opens large, with
      Previous / Next, arrow keys, swipe, and Esc to close.
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
    var tiles = document.querySelectorAll(".jg-work .jg-item");
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

  // ---------- 5. Image viewer ----------
  var labelsAttr = document.body.getAttribute("data-viewer-labels");
  var links = document.querySelectorAll("a[data-viewer]");
  if (labelsAttr && links.length && window.HTMLDialogElement) {
    var L = JSON.parse(labelsAttr);
    var rtl = root.dir === "rtl";
    var current = 0;
    var opener = null;

    var dialog = document.createElement("dialog");
    dialog.className = "viewer";
    dialog.setAttribute("aria-label", L.label);
    var bar = document.createElement("div"); bar.className = "viewer-bar";
    var count = document.createElement("p"); count.className = "viewer-count"; count.setAttribute("aria-live", "polite");
    var close = document.createElement("button"); close.type = "button"; close.textContent = L.close;
    bar.appendChild(count); bar.appendChild(close);
    var stage = document.createElement("div"); stage.className = "viewer-stage";
    var big = document.createElement("img"); big.decoding = "async";
    // The large picture is added only when the viewer first opens, so the
    // page never contains an image without an address.
    var foot = document.createElement("div");
    var caption = document.createElement("p"); caption.className = "viewer-caption";
    var nav = document.createElement("div"); nav.className = "viewer-nav";
    var prev = document.createElement("button"); prev.type = "button"; prev.textContent = L.previous;
    var next = document.createElement("button"); next.type = "button"; next.textContent = L.next;
    nav.appendChild(prev); nav.appendChild(next);
    foot.appendChild(caption); foot.appendChild(nav);
    dialog.appendChild(bar); dialog.appendChild(stage); dialog.appendChild(foot);
    document.body.appendChild(dialog);

    var show = function (i) {
      current = (i + links.length) % links.length;
      var a = links[current];
      var thumb = a.querySelector("img");
      big.classList.add("is-changing");
      var src = a.getAttribute("href");
      var swap = function () {
        big.src = src;
        big.alt = thumb ? thumb.alt : "";
        if (!big.parentNode) stage.appendChild(big);
        if (thumb && thumb.width) { big.width = thumb.getAttribute("width"); big.height = thumb.getAttribute("height"); }
        var cap = a.querySelector(".jg-caption");
        caption.textContent = cap ? cap.textContent : "";
        count.textContent = links.length > 1 ? L.count.replace("{n}", current + 1).replace("{total}", links.length) : "";
        requestAnimationFrame(function () { big.classList.remove("is-changing"); });
      };
      if (big.getAttribute("src")) setTimeout(swap, 120); else swap();
    };
    prev.hidden = next.hidden = links.length < 2;

    each(links, function (a, i) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab etc.
        e.preventDefault();
        opener = a;
        big.removeAttribute("src");
        show(i);
        dialog.showModal();
        close.focus();
      });
    });
    close.addEventListener("click", function () { dialog.close(); });
    prev.addEventListener("click", function () { show(current - 1); });
    next.addEventListener("click", function () { show(current + 1); });
    dialog.addEventListener("close", function () { if (opener) opener.focus(); });
    // Clicking the dark area around the picture closes the viewer.
    stage.addEventListener("click", function (e) { if (e.target === stage) dialog.close(); });
    dialog.addEventListener("keydown", function (e) {
      if (links.length < 2) return;
      if (e.key === "ArrowRight") { e.preventDefault(); show(current + (rtl ? -1 : 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(current + (rtl ? 1 : -1)); }
    });
    var startX = null;
    stage.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (startX === null || links.length < 2) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) < 50) return;
      var forward = dx < 0 ? !rtl : rtl; // swipe toward reading direction = next
      show(current + (forward ? 1 : -1));
    }, { passive: true });
  }
})();

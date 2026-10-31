/* ==========================================================
   BubaPix — site script (redesign v2)
   1. Opening moment for the main image.
   2. Small-screen menu.
   3. Work filter by category.
   4. Language switch: remembers the choice and keeps the
      section you were reading.
   5. Image viewer on project pages: a picture opens large, with
      Previous / Next, arrow keys, swipe, and Esc to close.
   6. Videos: the YouTube / Vimeo player loads only after "play".
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
  // Shop subcategories: choosing a main category opens a second row with its
  // subcategories; the main category stays marked while one is chosen.
  var filters = document.querySelector(".filters");
  if (filters) {
    var buttons = document.querySelectorAll(".filters .filter");
    var subStrips = document.querySelectorAll(".sub-strip");
    var tiles = document.querySelectorAll(".jg-work .jg-item, .product-grid [data-categories]");
    var apply = function (slug) {
      var chosen = document.querySelector('.filters [data-filter="' + slug + '"]');
      var strip = chosen && chosen.closest(".sub-strip");
      var main = strip ? strip.getAttribute("data-parent") : slug;
      each(buttons, function (b) {
        var f = b.getAttribute("data-filter");
        b.setAttribute("aria-pressed", String(b.closest(".sub-strip") ? f === slug : f === main));
      });
      each(subStrips, function (st) { st.hidden = st.getAttribute("data-parent") !== main; });
      var shown = 0;
      each(tiles, function (tile) {
        var cats = (tile.getAttribute("data-categories") || "").split(" ");
        tile.hidden = !!slug && cats.indexOf(slug) === -1;
        if (!tile.hidden) shown++;
      });
      // A category without products yet says so.
      var none = document.querySelector("[data-filter-empty]");
      if (none) none.hidden = shown > 0;
    };
    // Screen readers hear how many are shown after a choice (not on page load).
    var status = document.querySelector("[data-filter-status]");
    var say = function () {
      if (!status) return;
      var n = 0;
      each(tiles, function (tile) { if (!tile.hidden) n++; });
      var text = n === 0 ? status.getAttribute("data-none") : n === 1 ? status.getAttribute("data-one") : (status.getAttribute("data-many") || "").replace("{n}", n);
      status.textContent = "";
      setTimeout(function () { status.textContent = text; }, 50);
    };
    each(buttons, function (b) {
      b.addEventListener("click", function () {
        var slug = b.getAttribute("data-filter");
        apply(slug);
        say();
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search + (slug ? "#" + slug : ""));
        }
      });
    });
    filters.hidden = false;
    // Category row: arrow buttons scroll it sideways (for mouse users).
    if (filters.classList.contains("cat-strip")) {
      var wrap = document.createElement("div");
      wrap.className = "cat-wrap";
      filters.parentNode.insertBefore(wrap, filters);
      wrap.appendChild(filters);
      var rtl = document.documentElement.dir === "rtl";
      [["prev", "‹"], ["next", "›"]].forEach(function (d) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cat-arrow cat-" + d[0];
        btn.setAttribute("aria-hidden", "true");
        btn.tabIndex = -1;
        btn.textContent = rtl ? (d[0] === "prev" ? "›" : "‹") : d[1];
        btn.addEventListener("click", function () {
          var step = filters.clientWidth * 0.8 * (d[0] === "next" ? 1 : -1) * (rtl ? -1 : 1);
          filters.scrollBy({ left: step, behavior: "smooth" });
        });
        wrap.appendChild(btn);
      });
      var syncArrows = function () {
        var max = filters.scrollWidth - filters.clientWidth;
        var pos = Math.abs(filters.scrollLeft);
        wrap.classList.toggle("can-prev", pos > 4);
        wrap.classList.toggle("can-next", pos < max - 4);
      };
      filters.addEventListener("scroll", syncArrows, { passive: true });
      window.addEventListener("resize", syncArrows);
      syncArrows();
    }
    var start = location.hash.slice(1);
    if (start && document.querySelector('.filters [data-filter="' + start.replace(/[^a-z0-9-]/g, "") + '"]')) apply(start);
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
  var allLinks = document.querySelectorAll("a[data-viewer]");
  var links = allLinks;
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

    each(allLinks, function (a) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab etc.
        e.preventDefault();
        // While the owner edits on the page, a click selects the picture instead.
        if (root.classList.contains("page-editing")) return;
        // Previous / Next follow the order on screen (the homepage arranges
        // its pictures differently on phones).
        links = Array.prototype.slice.call(document.querySelectorAll("a[data-viewer]")).filter(function (x) { return x.getClientRects().length > 0; });
        var i = Math.max(0, links.indexOf(a));
        prev.hidden = next.hidden = links.length < 2;
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

  // ---------- 6. Edit buttons for the site owner ----------
  // Switched on from the Manage page and remembered only in this browser.
  // The buttons just open the admin panel, which asks for the owner's sign-in.
  var EDIT = "bubapix-edit";
  function editOn() { try { return localStorage.getItem(EDIT) === "1"; } catch (e) { return false; } }
  function setEdit(on) {
    try { if (on) localStorage.setItem(EDIT, "1"); else localStorage.removeItem(EDIT); } catch (e) { /* storage blocked */ }
    applyEdit();
  }
  // The edit tools show only where the switch is on AND this browser is
  // signed in with the owner's GitHub key (saved by the admin panel), so a
  // visitor who finds the Manage page and flips the switch still sees nothing.
  function signedIn() {
    try { var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null"); return !!(u && u.token); } catch (e) { return false; }
  }
  // Editing works only on the site's own addresses and never inside a frame
  // of another site. A copy of the pages served from anywhere else (for
  // example a draft preview on a shared service) shows no edit tools, so the
  // owner's GitHub key is never used there. Same list in admin/index.html.
  var EDIT_HOSTS = ["moshiko259-maker.github.io", "bubapix.com", "www.bubapix.com", "localhost", "127.0.0.1"];
  function editPlace() {
    var framed = true;
    try { framed = window.top !== window.self; } catch (e) { framed = true; }
    return !framed && EDIT_HOSTS.indexOf(location.hostname) !== -1;
  }
  function applyEdit() {
    var on = editOn();
    var show = on && signedIn() && editPlace();
    each(document.querySelectorAll("[data-edit-bar]"), function (bar) { bar.hidden = !show; });
    root.classList.toggle("edit-mode", show);
    each(document.querySelectorAll("[data-edit-toggle]"), function (b) {
      b.textContent = b.getAttribute(on ? "data-off" : "data-on");
      b.setAttribute("aria-pressed", String(on));
    });
  }
  each(document.querySelectorAll("[data-edit-toggle]"), function (b) {
    b.addEventListener("click", function () { setEdit(!editOn()); });
  });
  each(document.querySelectorAll("[data-edit-off]"), function (b) {
    b.addEventListener("click", function () { setEdit(false); });
  });
  applyEdit();
  // Manage page: is this browser signed in for editing? (The admin panel
  // keeps the owner's sign-in in this browser; nothing is sent anywhere.)
  each(document.querySelectorAll("[data-signin]"), function (box) {
    var token = "";
    try { var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null"); token = u && typeof u.token === "string" ? u.token : ""; } catch (e) { token = ""; }
    var ok = !!token;
    var show = function (which) {
      each(box.querySelectorAll("[data-signin-ok], [data-signin-no], [data-signin-expired]"), function (n) { n.hidden = !n.hasAttribute(which); });
      box.classList.toggle("is-ok", which === "data-signin-ok");
      box.classList.toggle("is-warn", which === "data-signin-expired");
    };
    box.hidden = false;
    show(ok ? "data-signin-ok" : "data-signin-no");
    // A saved key can expire or be revoked: ask GitHub once whether it still works.
    if (ok && editPlace() && window.fetch) {
      fetch("https://api.github.com/user", { headers: { "Accept": "application/vnd.github+json", "Authorization": "token " + token }, cache: "no-store" })
        .then(function (r) { if (r.status === 401 || r.status === 403) show("data-signin-expired"); })
        .catch(function () { /* offline: keep what we know */ });
    }
  });
  // "Open the homepage for editing" (Manage page) arrives with #edit.
  if (location.hash === "#edit" && editPlace() && document.querySelector("[data-page-editor]")) {
    setEdit(true);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* old browser */ }
    setTimeout(function () { var b = document.querySelector("[data-page-editor]"); if (b) b.click(); }, 0);
  }
  // "Edit on the page" (owner only): loads the page editor when pressed.
  each(document.querySelectorAll("[data-page-editor]"), function (b) {
    b.addEventListener("click", function () {
      var details = b.closest("details");
      if (details) details.open = false;
      if (document.querySelector("script[data-page-editor-script]")) return;
      // First the parts all the editors share (js/editor-core.js), then this page's editor.
      var add = function () {
        var s = document.createElement("script");
        s.src = b.getAttribute("data-src");
        s.setAttribute("data-page-editor-script", "");
        document.head.appendChild(s);
      };
      var core = b.getAttribute("data-core-src");
      if (!core || window.BubaCore) { add(); return; }
      var c = document.createElement("script");
      c.src = core;
      c.setAttribute("data-page-editor-script", "");
      c.onload = add;
      c.onerror = function () { c.remove(); };
      document.head.appendChild(c);
    });
  });

  // ---------- 7. Homepage mosaic on phones ----------
  // The pictures are moved into rows of at most two (their places are
  // prepared by build.js in data-srow), and back when the screen widens.
  // Every such block (the gallery and the posters row) is arranged this way.
  each(document.querySelectorAll("[data-mosaic]"), function (mosaic) {
    var wideRows = Array.prototype.slice.call(mosaic.children);
    var cells = Array.prototype.slice.call(mosaic.querySelectorAll("[data-srow]"));
    var homes = cells.map(function (c) { return c.parentNode; });
    var smallRows = [];
    var phone = window.matchMedia("(max-width: 700px)");
    var layout = function () {
      if (phone.matches && !mosaic.classList.contains("is-small")) {
        cells.forEach(function (c) {
          var parts = c.getAttribute("data-srow").split(":");
          var r = Number(parts[0]);
          if (!smallRows[r]) { smallRows[r] = document.createElement("div"); smallRows[r].className = "mrow n" + parts[1]; }
          smallRows[r].appendChild(c);
        });
        wideRows.forEach(function (row) { row.hidden = true; });
        smallRows.forEach(function (row) { if (row) mosaic.appendChild(row); });
        mosaic.classList.add("is-small");
      } else if (!phone.matches && mosaic.classList.contains("is-small")) {
        cells.forEach(function (c, n) { homes[n].appendChild(c); });
        smallRows.forEach(function (row) { if (row && row.parentNode) row.parentNode.removeChild(row); });
        wideRows.forEach(function (row) { row.hidden = false; });
        mosaic.classList.remove("is-small");
      }
    };
    layout();
    if (phone.addEventListener) phone.addEventListener("change", layout);
    else if (phone.addListener) phone.addListener(layout);
  });

  // ---------- 8. Installable app ----------
  // Registers the helper that lets the site be added to the home screen and
  // open offline. Its address is next to the app manifest (the site root).
  var manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink && "serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(new URL("sw.js", manifestLink.href).href).catch(function () { /* not available here */ });
    });
  }

  // ---------- 9. "Install the app" button ----------
  var installBtn = document.querySelector("[data-install]");
  var installHelp = document.querySelector("[data-install-help]");
  if (installBtn) {
    var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    var ua = navigator.userAgent || "";
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var deferred = null;
    if (!standalone) {
      // Android / Chrome / Edge: the browser offers its own install window.
      window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        deferred = e;
        installBtn.hidden = false;
      });
      // iPhone / iPad: no install window; show the steps instead.
      if (isIOS && installHelp && installHelp.showModal) installBtn.hidden = false;
    }
    installBtn.addEventListener("click", function () {
      if (deferred) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; installBtn.hidden = true; });
      } else if (installHelp && installHelp.showModal) {
        installHelp.showModal();
      }
    });
    window.addEventListener("appinstalled", function () { installBtn.hidden = true; });
    var closeHelp = document.querySelector("[data-install-close]");
    if (closeHelp) closeHelp.addEventListener("click", function () { installHelp.close(); });
  }

  // ---------- Videos: the player loads only after "play" ----------
  // Until then nothing is loaded from YouTube or Vimeo (see the privacy page).
  // Without this script the button opens the video on its own site.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.video-play[data-embed]");
    if (!a || document.documentElement.classList.contains("page-editing")) return;
    e.preventDefault();
    var f = document.createElement("iframe");
    f.src = a.getAttribute("data-embed");
    f.title = a.getAttribute("data-embed-title") || "";
    f.setAttribute("allow", a.getAttribute("data-embed-allow") || "");
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    a.parentNode.replaceChild(f, a);
    f.focus();
  });
})();

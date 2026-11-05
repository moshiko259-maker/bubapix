/*
 * BubaPix: the parts every on-page editor shares (owner only).
 *
 * Loaded by js/main.js just before an editor (js/editor.js, js/project-editor.js,
 * js/work-editor.js, js/page-editor.js), only when the owner presses
 * "Edit on the page". Nothing here runs for visitors.
 *
 * Before this file each editor had its own copy of these helpers; a fix in
 * one copy did not reach the others. Now there is one copy:
 *   BubaCore.el, button        building the editor's elements and buttons
 *   BubaCore.token             the owner's GitHub sign-in saved by the admin panel
 *   BubaCore.utf8ToB64, b64ToUtf8, readB64   files to and from GitHub's base64
 *   BubaCore.github(launcher, onCommit)      calls to the repository on GitHub
 *   BubaCore.loadStyles(launcher, onChange)  text styles + quick publishing
 *   BubaCore.history(launcher, opts)         "Earlier versions" (js/history.js)
 *   BubaCore.siteWatch(opts)                 "the site is updated ✓" after a save
 *   BubaCore.describe(T, he, en, done)       "Description for blind visitors" window
 *   BubaCore.captionDialog(T, g, lang, choices, done, pre)  "Title and text" window for a picture
 *   BubaCore.frame(box, o, T)                size by dragging a dot (computers): o.start, area, live, done, min, max
 *   BubaCore.aligner(opts)                   one width for several marked pictures (see aligner below)
 *   BubaCore.saveFiles(opts)                 saving: check every file first, then write and verify (see below)
 *   BubaCore.saveErrorText(err)              the message for a save that was not verified
 *   BubaCore.shrinkImage(file)               a picture chosen on this computer, made web-sized before it goes up
 *   (every editor window, class "pe-modal": keyboard focus moves into it, Tab stays
 *    inside it, and closing it brings focus back to where it was; see dialogFocus)
 *   BubaCore.version                         editors that need a newer copy load it again (a browser
 *                                            can keep an older copy of this file for a few minutes)
 */
(function () {
  "use strict";
  var VERSION = 10; // 10: aligner (one width for several marked pictures)
  if (window.BubaCore && window.BubaCore.version >= VERSION) return;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function button(label, onClick, cls, title) {
    // A name for screen readers only when the button shows a sign and no words.
    var a = { type: "button", "class": cls || "pe-btn", text: label, title: title || label, onclick: onClick };
    if (title && !/[A-Za-z֐-׿]/.test(label)) a["aria-label"] = title;
    return el("button", a);
  }
  function token() {
    try {
      var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null");
      if (u && typeof u.token === "string" && u.token) return u.token;
    } catch (e) { /* storage blocked */ }
    return "";
  }
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // A picture chosen on this computer, as base64 for GitHub.
  function readB64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  // Calls to the repository (the launcher says which one and which branch).
  // onCommit(sha) hears the version made by each save, to tell when the
  // test site shows it.
  function github(launcher, onCommit) {
    var REPO = launcher.getAttribute("data-repo"), BRANCH = launcher.getAttribute("data-branch");
    var API = "https://api.github.com/repos/" + REPO;
    function api(path, opts) {
      opts = opts || {};
      var headers = { "Accept": "application/vnd.github+json", "Authorization": "token " + token() };
      if (opts.body) headers["Content-Type"] = "application/json";
      return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
        .then(function (res) {
          return res.text().then(function (txt) {
            var data = null;
            try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
            if (!res.ok) { var err = new Error("GitHub " + res.status); err.status = res.status; err.data = data; throw err; }
            if (opts.method === "PUT" && data && data.commit && data.commit.sha && onCommit) onCommit(data.commit.sha);
            return data;
          });
        });
    }
    return {
      api: api,
      REPO: REPO,
      BRANCH: BRANCH,
      encPath: function (p) { return p.split("/").map(encodeURIComponent).join("/"); },
      ref: "?ref=" + encodeURIComponent(BRANCH),
    };
  }

  function addScript(src, onDone) {
    var sc = document.createElement("script");
    sc.src = src;
    if (onDone) sc.onload = sc.onerror = onDone;
    document.head.appendChild(sc);
  }
  // Text styles (js/text-style.js) and publishing the test site right after a save (js/preview-publish.js).
  function loadStyles(launcher, onChange) {
    var pp = launcher.getAttribute("data-pp-src");
    if (pp && !window.BubaPublish) addScript(pp);
    var src = launcher.getAttribute("data-ts-src");
    var go = function () { if (window.BubaStyle) window.BubaStyle.start({ onChange: onChange }).catch(function () { /* styles stay as they are */ }); };
    if (window.BubaStyle || !src) { go(); return; }
    var sc = document.createElement("script");
    sc.src = src; sc.onload = go;
    document.head.appendChild(sc);
  }

  // "Earlier versions": js/history.js, loaded on first use.
  // opts: api, path, branch, title, note, load, onLoaded, onError, onMissing.
  function history(launcher, opts) {
    var go = function () {
      if (!window.BubaHistory) { if (opts.onMissing) opts.onMissing(); return; }
      window.BubaHistory.open(opts);
    };
    var src = launcher.getAttribute("data-hist-src");
    if (window.BubaHistory || !src) { go(); return; }
    addScript(src, go);
  }

  // After a save: say "saved", then "the site is updated ✓" once the test
  // site serves that version (its version.txt), with a reload button.
  // opts: base (the site's root), api, T (saved, publishing, published,
  // reload, slow, unsaved), status (the status element), setStatus, dirty,
  // beforeReload (optional).
  function siteWatch(opts) {
    var w = { available: false, savedCommit: "", timer: 0, started: 0 };
    var T = opts.T;
    function readVersion() {
      return fetch(opts.base + "version.txt?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (t) { return /^[0-9a-f]{40}$/.test(t.trim()) ? t.trim() : ""; })
        .catch(function () { return ""; });
    }
    function watch() { readVersion().then(function (v) { w.available = !!v; }); }
    // extra: text added after "saved" (for example about the translation); kind: "ok" or "warn".
    function follow(commitSha, extra, kind) {
      extra = extra || ""; kind = kind || "ok";
      if (window.BubaPublish && commitSha) window.BubaPublish.after(commitSha);
      if (!w.available || !commitSha) { opts.setStatus(T.saved + extra, kind); return; }
      w.savedCommit = commitSha; w.started = Date.now();
      opts.setStatus(T.publishing + extra, kind);
      clearTimeout(w.timer);
      var check = function () {
        if (w.savedCommit !== commitSha) return;
        readVersion().then(function (live) {
          if (!live) return false;
          if (live === commitSha) return true;
          return opts.api("/compare/" + commitSha + "..." + live).then(function (c) { return c && (c.status === "ahead" || c.status === "identical"); }).catch(function () { return false; });
        }).then(function (done) {
          if (w.savedCommit !== commitSha) return;
          if (done) {
            if (opts.dirty()) { opts.setStatus(T.published + " · " + T.unsaved, "warn"); return; }
            var status = opts.status;
            status.textContent = "";
            status.className = "pe-status is-ok";
            status.appendChild(document.createTextNode(T.published + " "));
            status.appendChild(button(T.reload, function () { if (opts.beforeReload) opts.beforeReload(); location.reload(); }, "pe-btn"));
            return;
          }
          if (Date.now() - w.started > 15 * 60 * 1000) { opts.setStatus(T.slow, "warn"); return; }
          w.timer = setTimeout(check, 20000);
        });
      };
      w.timer = setTimeout(check, 20000);
    }
    return { watch: watch, follow: follow };
  }

  // Keyboard focus in the editor windows (every element with class "pe-modal", in
  // all the editors and in "Earlier versions"), in one place:
  //  - when a window opens and focus is not inside it, focus moves to its first
  //    field or button (not "Close" in the title row, when there is anything else);
  //  - Tab and Shift+Tab stay inside the top window;
  //  - when the window closes and focus was lost (left on the page body), it goes
  //    back to the button that opened the window.
  function dialogFocus() {
    if (window.__bubaDialogFocus) return;
    window.__bubaDialogFocus = true;
    var SEL = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var recent = [];
    var openers = [];
    function topModal() { var all = document.querySelectorAll(".pe-modal"); return all.length ? all[all.length - 1] : null; }
    function focusables(box) {
      return Array.prototype.filter.call(box.querySelectorAll(SEL), function (n) { return !n.closest("[hidden]") && n.getClientRects().length; });
    }
    // The last places focus was in, newest first: the opener of a window is the
    // newest one outside it (it can be inside another window under it).
    document.addEventListener("focusin", function (e) {
      if (e.target === document.body) return;
      recent.unshift(e.target);
      if (recent.length > 20) recent.length = 20;
    }, true);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var box = topModal();
      if (!box) return;
      var list = focusables(box);
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1], cur = document.activeElement;
      if (!box.contains(cur)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    }, true);
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList.contains("pe-modal")) return;
          openers.push({ box: n, from: recent.filter(function (f) { return !n.contains(f); })[0] || null });
          if (n.contains(document.activeElement)) return;
          var list = focusables(n);
          var inBody = list.filter(function (b) { return !b.closest(".pe-modal-head"); });
          var go = inBody[0] || list[0];
          if (go) go.focus();
        });
        Array.prototype.forEach.call(r.removedNodes, function (n) {
          if (n.nodeType !== 1 || !n.classList.contains("pe-modal")) return;
          var i = openers.map(function (o) { return o.box; }).indexOf(n);
          if (i < 0) return;
          var from = openers.splice(i, 1)[0].from;
          var lost = !document.activeElement || document.activeElement === document.body;
          if (lost && from && document.contains(from)) from.focus();
        });
      });
    }).observe(document.body, { childList: true });
  }
  dialogFocus();

  // Moving pictures with a finger (phones and tablets). The editors move
  // pictures with drag and drop ([draggable="true"] and the dragstart /
  // dragover / drop / dragend events), which browsers fire for a mouse only.
  // Here a long press (0.4 s) on a picture starts the same drag: the picture
  // follows the finger, and the same events are sent to the pictures under it,
  // so every editor's own drop rules apply unchanged. A short tap still only
  // chooses the picture; a swipe still scrolls; a press on a button, menu or
  // blue dot is left alone.
  function touchDrag() {
    if (window.__bubaTouchDrag) return;
    window.__bubaTouchDrag = true;
    var LONG = 400, SLOP = 10;
    var timer = 0, src = null, startX = 0, startY = 0, active = false, last = null, accepted = false, lx = 0, ly = 0, dt = null, scrollTimer = 0;
    var NOT = "button, select, input, textarea, a, .pe-dot, .pe-resize, [contenteditable], .pe-modal";
    function evt(type, target, x, y) {
      var e;
      try { e = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }); }
      catch (err) { e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }); }
      target.dispatchEvent(e);
      return e;
    }
    function itemAt(x, y) {
      src.style.pointerEvents = "none";
      var n = document.elementFromPoint(x, y);
      src.style.pointerEvents = "";
      n = n && n.closest ? n.closest('[draggable="true"]') : null;
      return n && n !== src ? n : null;
    }
    function reset() {
      clearTimeout(timer); clearInterval(scrollTimer); timer = 0; scrollTimer = 0;
      if (src) { src.classList.remove("pe-touch-drag"); src.style.transform = ""; src.style.zIndex = ""; }
      if (last) last.classList.remove("is-target");
      src = null; active = false; last = null; accepted = false;
    }
    function begin() {
      timer = 0;
      if (!src) return;
      try { dt = new DataTransfer(); } catch (e) { dt = null; }
      var e = evt("dragstart", src, startX, startY);
      if (e.defaultPrevented) { reset(); return; }
      active = true;
      src.classList.add("pe-touch-drag");
      src.style.zIndex = "70";
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) { /* not allowed */ } }
      // Near the top or bottom of the screen, the page scrolls by itself.
      scrollTimer = setInterval(function () {
        var h = window.innerHeight, edge = 70;
        if (ly < edge) window.scrollBy(0, -12); else if (ly > h - edge) window.scrollBy(0, 12);
      }, 30);
    }
    document.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || !document.querySelector(".pe-bar")) return;
      var t = e.target && e.target.closest ? e.target : null;
      var item = t && t.closest('[draggable="true"]');
      if (!item || t.closest(NOT)) return;
      reset();
      src = item; startX = lx = e.touches[0].clientX; startY = ly = e.touches[0].clientY;
      timer = setTimeout(begin, LONG);
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!src) return;
      var x = e.touches[0].clientX, y = e.touches[0].clientY;
      if (!active) {
        // Moved before the long press ended: the finger is scrolling the page.
        if (Math.abs(x - startX) > SLOP || Math.abs(y - startY) > SLOP) reset();
        return;
      }
      e.preventDefault();
      lx = x; ly = y;
      src.style.transform = "translate(" + (x - startX) + "px, " + (y - startY) + "px) scale(0.92)";
      // Over a gap between pictures (or a bar), the last picture stays the target.
      var over = itemAt(x, y);
      if (!over) return;
      if (over !== last) { if (last) { last.classList.remove("is-target"); evt("dragleave", last, x, y); } last = over; accepted = false; }
      accepted = evt("dragover", over, x, y).defaultPrevented;
    }, { passive: false });
    function end(e) {
      if (!src) return;
      if (!active) { reset(); return; }
      if (e.cancelable) e.preventDefault(); // no click on the picture after a drag
      var s = src, target = last, ok = accepted;
      src.style.transform = "";
      if (target && ok) evt("drop", target, lx, ly);
      evt("dragend", s, lx, ly);
      reset();
    }
    document.addEventListener("touchend", end, { passive: false });
    document.addEventListener("touchcancel", end, { passive: false });
  }
  touchDrag();
  // While a picture's dot is dragged (computers): the picture takes that width at
  // once, so the change is seen. "important" beats the gallery rules
  // (.mrow .jg-item { flex-basis: 0 !important } and the built fs-/fr- classes),
  // which otherwise shrank it to nothing or kept it as it was until the release.
  // On release: the other pictures in the same row keep the width they had while
  // dragging (they filled the rest of the row), so nothing jumps afterwards.
  // set(node, pct) writes each one's width; area is the gallery's width.
  function rowWidths(node, area, set) {
    var row = node.parentElement;
    if (!row || !row.classList.contains("mrow")) return;
    Array.prototype.forEach.call(row.children, function (n) {
      if (n === node || !n.getBoundingClientRect) return;
      var w = n.getBoundingClientRect().width;
      if (w > 0) set(n, Math.max(10, Math.min(100, Math.round(w / (area || 1) * 100))));
    });
  }
  // After a resize (computers): the site fills every row of several pictures to
  // the full width (src/render.js freeClasses: widths over 100 squeezed, under 100
  // stretched). So a resized picture whose row did not add up to 100 did not keep
  // its width: the last picture of a gallery, with nothing after it to fill the
  // row, jumped back. Now the other pictures of its row share the rest of the row.
  // nodes: the gallery's pictures in page order; get(n): width in % (none: 33,
  // as the site); set(n, w): writes one; node: the resized picture (width set).
  function fillRow(nodes, node, get, set) {
    nodes = Array.prototype.slice.call(nodes);
    var at = nodes.indexOf(node);
    if (at < 0) return;
    var w = nodes.map(function (n) { return Number(get(n)) || 33; });
    var rows = [], row = [], sum = 0;
    w.forEach(function (f, i) {
      if (row.length && sum + f > 106) { rows.push(row); row = []; sum = 0; }
      row.push(i); sum += f;
    });
    if (row.length) rows.push(row);
    var mine = rows.filter(function (r) { return r.indexOf(at) >= 0; })[0];
    if (!mine || mine.length < 2) return; // alone in its row: shown at its own width
    var others = mine.filter(function (i) { return i !== at; });
    var rest = 100 - w[at], have = others.reduce(function (a, i) { return a + w[i]; }, 0);
    if (rest < 10 * others.length || !have) return;
    var left = rest;
    others.forEach(function (i, k) {
      var v = k === others.length - 1 ? Math.max(10, left) : Math.max(10, Math.round(w[i] / have * rest));
      left -= v; set(nodes[i], v);
    });
  }
  function liveWidth(node, pct) {
    node.style.setProperty("flex", "0 0 calc(" + pct + "% - 0.5rem)", "important");
    node.style.setProperty("width", "calc(" + pct + "% - 0.5rem)", "important");
    node.style.setProperty("min-width", "0", "important");
    node.style.setProperty("max-width", "none", "important");
  }

  function modal(label, kids, focus) {
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": label }, [
      el("div", { "class": "pe-modal-box pe-small-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: label }), button(kids.closeText, function () { close(); }, "pe-btn pe-ghost")]),
        el("div", { "class": "pe-modal-foot" }, kids.body),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dialog);
    if (focus) focus.focus();
    return close;
  }
  // "Description for blind visitors": both languages at once.
  // T: describe, altEdit, altHe, altEn, ok, close.
  function describe(T, curHe, curEn, done) {
    var he = document.documentElement.lang === "he";
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input", value: curHe || "" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input", value: curEn || "" });
    var close = modal(T.describe, { closeText: T.close, body: [
      el("p", { "class": "pe-note", text: T.altEdit }),
      el("label", {}, [document.createTextNode(T.altHe), altHe]),
      el("label", {}, [document.createTextNode(T.altEn), altEn]),
      button(T.ok, function () { close(); done({ he: altHe.value.trim(), en: altEn.value.trim() }); }, "pe-btn pe-primary"),
    ] }, he ? altHe : altEn);
  }
  function cleanText(text) { return String(text || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }
  // "Title and text" for one picture (<pre>title_<lang>, <pre>note_<lang>, <pre>caption), in the
  // page's language. pre: "" for a gallery picture, "hero_" / "feature_" / "cover_" for the others.
  // choices: [[value, label], ...] for "Where to show it"; the first one is "not shown".
  // T: caption, captionTitle, captionNote, captionWhere, captionNoteHelp, ok, close.
  function captionDialog(T, g, lang, choices, done, pre) {
    pre = pre || "";
    var dir = lang === "he" ? "rtl" : "ltr";
    var title = el("input", { type: "text", dir: dir, "class": "pe-input", "data-cap-title": "", value: g[pre + "title_" + lang] || "" });
    var note = el("textarea", { dir: dir, "class": "pe-input pe-textarea", rows: "3", "data-cap-note": "" });
    note.value = g[pre + "note_" + lang] || "";
    var where = el("select", { "class": "pe-input", "data-cap-where": "" }, choices.map(function (o) { return el("option", { value: o[0], text: o[1] }); }));
    var values = choices.map(function (o) { return o[0]; });
    // A picture that has no title yet: what is written will most likely be shown.
    var cur = g[pre + "caption"];
    where.value = cur && cur !== values[0] && values.indexOf(cur) >= 0 ? cur : (g[pre + "title_" + lang] || g[pre + "note_" + lang] ? values[0] : values[1] || values[0]);
    // Above or under the picture (<pre>caption_pos: "above"; under when empty).
    var he = lang === "he";
    var pos = el("select", { "class": "pe-input", "data-cap-pos": "" }, [
      el("option", { value: "", text: he ? "מתחת לתמונה" : "Under the picture" }),
      el("option", { value: "above", text: he ? "מעל התמונה" : "Above the picture" }),
    ]);
    pos.value = g[pre + "caption_pos"] === "above" ? "above" : "";
    var close = modal(T.caption, { closeText: T.close, body: [
      el("label", {}, [document.createTextNode(T.captionTitle), title]),
      el("label", {}, [document.createTextNode(T.captionNote), note]),
      el("label", {}, [document.createTextNode(T.captionWhere), where]),
      el("label", {}, [document.createTextNode(he ? "מיקום" : "Position"), pos]),
      el("p", { "class": "pe-note", text: he ? "גופן, גודל ויישור: לוחצים על הכותרת או על התיאור בדף. העיצוב חל על כל הכותרות והתיאורים בדף." : "Font, size and alignment: click the title or the text on the page. The style applies to every picture title and text on the page." }),
      el("p", { "class": "pe-note", text: T.captionNoteHelp }),
      button(T.ok, function () {
        close();
        g[pre + "title_" + lang] = title.value.replace(/\s+/g, " ").trim();
        g[pre + "note_" + lang] = cleanText(note.value);
        g[pre + "caption"] = where.value;
        if (pos.value === "above") g[pre + "caption_pos"] = "above"; else delete g[pre + "caption_pos"];
        done();
      }, "pe-btn pe-primary"),
    ] }, title);
  }

  // The title and text of a picture as visitors will see them, for the editors'
  // live view: tag "figcaption" or "span"; page: the text-style kind ("home",
  // "work", "project"); above: placed before media instead of after it.
  function capNode(tag, t1, t2, page, above) {
    return el(tag, { "class": "jg-caption pe-caption" + (above ? " cap-above" : "") }, [
      t1 ? el("span", { "class": "jg-title", "data-ts": page + "/cap-title", text: t1 }) : null,
      t2 ? el("span", { "class": "jg-note", "data-ts": page + "/cap-note", text: t2 }) : null,
    ]);
  }
  function placeCap(node, media, above) {
    var box = media.parentNode;
    box.insertBefore(node, above ? media : media.nextSibling);
  }

  // A picture's size by dragging one of six dots (as in the other editors).
  // o.start() → width now (%), o.area() → the width it is measured against (px),
  // o.live(pct) while dragging, o.done(pct) at the end; o.min/o.max (default 10/100).
  // T: frameTip, widthLabel.
  function frame(box, o, T) {
    var min = o.min || 10, max = o.max || 100;
    box.classList.add("pe-framed");
    if (o.selectedNow) box.classList.add("pe-selected");
    box.setAttribute("title", T.frameTip);
    box.addEventListener("click", function (e) {
      if (e.target.closest(".pe-tools, .pe-dot")) return;
      var was = box.classList.contains("pe-selected");
      Array.prototype.forEach.call(document.querySelectorAll(".pe-selected"), function (n) { n.classList.remove("pe-selected"); });
      if (!was) box.classList.add("pe-selected");
    });
    var label = el("span", { "class": "pe-frame-label" });
    box.appendChild(label);
    ["nw", "ne", "sw", "se", "w", "e"].forEach(function (pos) {
      var dot = el("span", { "class": "pe-dot pe-dot-" + pos, "aria-hidden": "true" });
      dot.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
      dot.addEventListener("dragstart", function (e) { e.preventDefault(); e.stopPropagation(); });
      dot.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        var drag = box.closest("[draggable]");
        if (drag) drag.setAttribute("draggable", "false");
        var startPct = o.start(), startX = e.clientX, startY = e.clientY;
        var areaW = o.area() || 1;
        var rd = dot.getBoundingClientRect(), b = box.getBoundingClientRect();
        var right = rd.left + rd.width / 2 > b.left + b.width / 2, bottom = pos.charAt(0) === "s";
        var pct = Math.round(startPct);
        box.classList.add("is-resizing", "pe-selected");
        try { dot.setPointerCapture(e.pointerId); } catch (x) { /* old browser */ }
        function mv(ev) {
          var dx = (ev.clientX - startX) * (right ? 1 : -1);
          var dy = pos.length === 2 ? (ev.clientY - startY) * (bottom ? 1 : -1) * (b.width / Math.max(1, b.height)) : 0;
          var dd = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
          pct = Math.max(min, Math.min(max, Math.round(startPct + dd / areaW * 100)));
          label.textContent = T.widthLabel + " " + pct + "%";
          o.live(pct);
        }
        function up() {
          dot.removeEventListener("pointermove", mv); dot.removeEventListener("pointerup", up); dot.removeEventListener("pointercancel", up);
          box.classList.remove("is-resizing");
          if (drag) drag.setAttribute("draggable", "true");
          if (pct !== Math.round(startPct)) o.done(pct);
          setTimeout(function () { label.textContent = ""; }, 900);
        }
        dot.addEventListener("pointermove", mv); dot.addEventListener("pointerup", up); dot.addEventListener("pointercancel", up);
      });
      box.appendChild(dot);
    });
  }

  // Saving, the same way in every editor:
  //   1. before writing anything, each file is checked: a file the editor
  //      loaded must still be the same version (sha) on GitHub (otherwise
  //      nothing is written: err.changed); a new file must not exist yet;
  //      a file that is only added to (merge) is read now, as it is now;
  //   2. pictures chosen on this computer go up;
  //   3. the files are written, one after the other.
  // Every write is verified before it counts as saved (read after write):
  //   - the editor works out the file's git fingerprint (blob sha) from the
  //     exact bytes it sends;
  //   - GitHub's answer must name that same fingerprint, and the file read
  //     back from the work branch must have it too.
  // When GitHub's answer is lost (no answer, or a server error), the file is
  // read back instead of being sent again (a second write could double a
  // save that did happen): the right fingerprint = saved; another one = not
  // saved; the file cannot be read = the result is unknown (err.uncertain).
  // opts: api, branch,
  //   uploads: [{ path, file, message, done() }],
  //   files: [{ path, sha ("" = a new file), text (the whole file) or
  //             merge(currentData) -> data (only some fields change; the
  //             rest of the file as it is now), message, saved(newSha) }]
  // Resolves to { wrote, verified } only when every write was verified. On
  // failure err.wrote says how many files were already written and verified
  // (so the editor can say "some changes were saved"); err.uncertain (the
  // result could not be checked) or err.verifyFailed (GitHub kept something
  // else) say more, with err.path. saveErrorText(err) gives the message.
  function bytesToB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  // git's fingerprint of a file: sha1("blob <size>\0" + bytes), as GitHub reports it.
  function blobSha(bytes) {
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve("");
    var head = new TextEncoder().encode("blob " + bytes.length + "\0");
    var all = new Uint8Array(head.length + bytes.length);
    all.set(head, 0); all.set(bytes, head.length);
    return window.crypto.subtle.digest("SHA-1", all).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }, function () { return ""; });
  }
  function fileBytes(file) {
    if (file.arrayBuffer) return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return readB64(file).then(function (b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function saveErr(kind, path, cause) {
    var e = new Error(kind + ": " + path);
    e[kind] = true; e.path = path;
    if (cause && cause.status) e.status = cause.status;
    return e;
  }

  function saveFiles(opts) {
    var api = opts.api, ref = "?ref=" + encodeURIComponent(opts.branch);
    var enc = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
    var files = opts.files || [], uploads = opts.uploads || [];
    var wrote = 0, verified = 0;
    var changedErr = function () { var e = new Error("changed"); e.changed = true; return e; };
    // The sha of the file on the work branch now ("" = no such file); a read that fails rejects.
    function readSha(path) {
      return api("/contents/" + enc(path) + ref).then(function (cur) { return cur && cur.sha ? cur.sha : ""; }, function (err) {
        if (err.status === 404) return "";
        throw err;
      });
    }
    // Reads back until the file has the expected fingerprint (GitHub can take
    // a moment to show a new version): true / false / rejects when unreadable.
    function readBack(path, want) {
      var tries = 0;
      var once = function () {
        return readSha(path).then(function (got) {
          if (got === want) return true;
          if (++tries >= 3) return false;
          return wait(1500 * tries).then(once);
        });
      };
      return once();
    }
    // One verified write. bytes: exactly what is sent.
    function put(path, body, bytes) {
      return blobSha(bytes).then(function (want) {
        return api("/contents/" + enc(path), { method: "PUT", body: body }).then(function (res) {
          var got = res && res.content ? res.content.sha : "";
          if (want && got && got !== want) throw saveErr("verifyFailed", path);
          if (!want) return got; // no fingerprint in this browser: GitHub's answer is what there is
          return readBack(path, want).then(function (ok) {
            if (!ok) throw saveErr("uncertain", path);
            return got || want;
          }, function (err) { throw saveErr("uncertain", path, err); });
        }, function (err) {
          // A clear "no" from GitHub (sign-in, permission, conflict, bad request): nothing was saved.
          if (err.status && err.status < 500) throw err;
          // No answer, or a server error: the write may still have happened. Look, do not send again.
          if (!want) throw saveErr("uncertain", path, err);
          return readBack(path, want).then(function (ok) {
            if (ok) return want;
            throw err;
          }, function (e2) { throw saveErr("uncertain", path, e2); });
        });
      });
    }
    var check = Promise.all(files.map(function (f) {
      return api("/contents/" + enc(f.path) + ref)
        .then(function (cur) {
          if (f.merge) return { sha: cur.sha, data: JSON.parse(b64ToUtf8(cur.content)) };
          if (cur.sha !== f.sha) throw changedErr();
          return { sha: f.sha };
        }, function (err) {
          if (err.status !== 404) throw err;
          if (f.sha || f.merge) throw changedErr();
          return { sha: "" };
        });
    }));
    return check.then(function (found) {
      var chain = Promise.resolve();
      uploads.forEach(function (u) {
        chain = chain.then(function () { return fileBytes(u.file); })
          .then(function (bytes) { return put(u.path, { message: u.message, content: bytesToB64(bytes), branch: opts.branch }, bytes); })
          .then(function () { verified++; if (u.done) u.done(); });
      });
      files.forEach(function (f, i) {
        chain = chain.then(function () {
          var text = f.merge ? JSON.stringify(f.merge(found[i].data), null, 2) + "\n" : f.text;
          var bytes = new TextEncoder().encode(text);
          var body = { message: f.message, content: bytesToB64(bytes), branch: opts.branch };
          if (found[i].sha) body.sha = found[i].sha;
          return put(f.path, body, bytes);
        }).then(function (newSha) {
          wrote++; verified++;
          if (f.saved) f.saved(newSha || "");
        });
      });
      return chain;
    }).then(function () { return { wrote: wrote, verified: verified }; }, function (err) { err.wrote = wrote; throw err; });
  }

  // The message for a save whose result was checked and found wrong or could
  // not be checked ("" for the other errors, which each editor words itself).
  function saveErrorText(err) {
    if (!err || !(err.uncertain || err.verifyFailed)) return "";
    var he = document.documentElement.lang === "he";
    var name = String(err.path || "").split("/").pop();
    if (err.verifyFailed) {
      return he
        ? "השמירה לא אומתה: GitHub שמר תוכן שונה ממה שנשלח (" + name + "). צאו מהעריכה, טענו את הדף מחדש ובדקו את השינוי."
        : "The save could not be verified: GitHub kept different content from what was sent (" + name + "). Leave editing, reload the page and check the change.";
    }
    return he
      ? "לא ברור אם השמירה הצליחה: הקשר עם GitHub נקטע ולא הצלחנו לבדוק את הקובץ (" + name + "). לא שלחנו שוב, כדי לא לשמור פעמיים. בדקו את החיבור, טענו את הדף מחדש ובדקו אם השינוי נשמר לפני שמנסים שוב."
      : "It is not clear whether the save worked: the connection to GitHub was cut and the file could not be checked (" + name + "). Nothing was sent again, so nothing is saved twice. Check the connection, reload the page and see whether the change is there before trying again.";
  }

  // A picture chosen on this computer or phone, made web-sized before it is
  // uploaded: the same rule as the admin panel (admin/config.yml,
  // transformations): WebP, quality 85, at most 2400 px wide or high, the
  // proportions kept, never enlarged. A picture already small enough (at most
  // 2400 px and 1.5 MB) and GIFs (they can move) stay as they are; so does any
  // picture whose new copy would not be smaller, or that this browser cannot
  // convert. Resolves to a File (the same one, or the smaller copy).
  var SHRINK_MAX = 2400, SHRINK_QUALITY = 0.85, SHRINK_KEEP_BYTES = 1.5 * 1024 * 1024;
  function shrinkImage(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type || "") || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
      var w = bmp.width, h = bmp.height, big = Math.max(w, h);
      if (big <= SHRINK_MAX && file.size <= SHRINK_KEEP_BYTES) { if (bmp.close) bmp.close(); return file; }
      var k = big > SHRINK_MAX ? SHRINK_MAX / big : 1;
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      var ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      return new Promise(function (resolve) { c.toBlob(resolve, "image/webp", SHRINK_QUALITY); }).then(function (blob) {
        // A browser without WebP output answers with a PNG: keep the original then.
        if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
        var name = String(file.name || "picture").replace(/\.[^.]+$/, "") + ".webp";
        try { return new File([blob], name, { type: "image/webp", lastModified: Date.now() }); }
        catch (e) { blob.name = name; return blob; }
      });
    }).catch(function () { return file; });
  }
  // Several files: each made web-sized, in the same order.
  function shrinkImages(list) { return Promise.all(Array.prototype.map.call(list || [], shrinkImage)); }

  // ---------- one width for several pictures (marked by hand) ----------
  // Every editor: mark pictures, choose one as the source, and "Match the source
  // width" gives all marked pictures its width on this screen size. Only by hand;
  // nothing is saved until the editor's "Save". The marks live in this tab only.
  var ALIGN_TEXT = {
    he: {
      posters: { mark: "סימון ליישור", unmark: "ביטול סימון", one: "סומן פוסטר אחד ליישור. סמנו עוד פוסטר אחד לפחות.", barPc: "{n} פוסטרים מסומנים. יקבלו את הרוחב במחשב של:", barPhone: "{n} פוסטרים מסומנים. יקבלו את הרוחב בטלפון של:", source: "הפוסטר שהרוחב שלו יועתק", go: "השוואה לרוחב המקור", clear: "ניקוי הסימון", auto: "רגיל, שניים בשורה", pairs: "רוחב 53 ומטה: הפוסטרים יעמדו בזוגות, ולא כל אחד לבד בשורה.", done: "כל {n} הפוסטרים המסומנים ברוחב {w}%.", doneAuto: "כל {n} הפוסטרים המסומנים חזרו לסידור הרגיל בטלפון (שניים בשורה).", same: "כל הפוסטרים המסומנים כבר באותו רוחב. לא שונה דבר." },
      pictures: { mark: "סימון ליישור", unmark: "ביטול סימון", one: "סומנה תמונה אחת ליישור. סמנו עוד תמונה אחת לפחות.", barPc: "{n} תמונות מסומנות. יקבלו את הרוחב במחשב של:", barPhone: "{n} תמונות מסומנות. יקבלו את הרוחב בטלפון של:", source: "התמונה שהרוחב שלה יועתק", go: "השוואה לרוחב המקור", clear: "ניקוי הסימון", auto: "רגיל", pairs: "רוחב 53 ומטה: התמונות יעמדו בזוגות, ולא כל אחת לבד בשורה.", done: "כל {n} התמונות המסומנות ברוחב {w}%.", doneAuto: "כל {n} התמונות המסומנות חזרו לסידור הרגיל בטלפון.", same: "כל התמונות המסומנות כבר באותו רוחב. לא שונה דבר." },
    },
    en: {
      posters: { mark: "Mark to align", unmark: "Unmark", one: "One poster marked to align. Mark at least one more.", barPc: "{n} posters marked. They will get the desktop width of:", barPhone: "{n} posters marked. They will get the phone width of:", source: "The poster whose width is copied", go: "Match the source width", clear: "Clear marks", auto: "Usual, two in a row", pairs: "Width 53 or less: the posters will appear in pairs, not each alone in its row.", done: "All {n} marked posters are now {w}% wide.", doneAuto: "All {n} marked posters are back to the usual phone layout (two in a row).", same: "All marked posters already have the same width. Nothing changed." },
      pictures: { mark: "Mark to align", unmark: "Unmark", one: "One picture marked to align. Mark at least one more.", barPc: "{n} pictures marked. They will get the desktop width of:", barPhone: "{n} pictures marked. They will get the phone width of:", source: "The picture whose width is copied", go: "Match the source width", clear: "Clear marks", auto: "Usual", pairs: "Width 53 or less: the pictures will appear in pairs, not each alone in its row.", done: "All {n} marked pictures are now {w}% wide.", doneAuto: "All {n} marked pictures are back to the usual phone layout.", same: "All marked pictures already have the same width. Nothing changed." },
    },
  };
  // opts:
  //   id        a name for this group of pictures (the bar's data-align)
  //   lang      "he" or "en";  noun: "posters" or "pictures" (the words used)
  //   phone()   true on a phone: the phone width is copied, otherwise the computer width
  //   items()   the pictures that can be marked now, in page order: [{ key, name }]
  //             (a picture that is no longer there leaves the marks by itself)
  //   width(key)  its width now on this screen size in %; 0 = no own width (the usual layout)
  //   apply(keys, w)  give these pictures width w (0 = no own width); the editor
  //             records the change (undo) and draws again, before this returns
  //   redraw()  draw again after a mark changed
  //   status(text, same)  show the message after matching (the editor adds "unsaved";
  //             same = true: nothing changed, so not that)
  //   pairs     true for rows of pictures: 53% or less puts two in one row (src/render.js freeClasses, 106)
  // Returns: has(key), button(key) → the mark button, mark(node, key) → the orange
  // frame (class pe-marked), bar() → the bar to put above the pictures (or null).
  function aligner(opts) {
    var A = (ALIGN_TEXT[opts.lang === "he" ? "he" : "en"])[opts.noun === "posters" ? "posters" : "pictures"];
    var marks = [], source = null;
    function present() {
      var list = opts.items() || [];
      marks = marks.filter(function (k) { return list.some(function (it) { return it.key === k; }); });
      return list.filter(function (it) { return marks.indexOf(it.key) >= 0; });
    }
    function has(key) { return marks.indexOf(key) >= 0 && (opts.items() || []).some(function (it) { return it.key === key; }); }
    function short(name) { name = String(name || ""); return name.length > 40 ? name.slice(0, 39) + "…" : name; }
    function match() {
      var marked = present();
      var src = marked.filter(function (it) { return it.key === source; })[0];
      if (!src || marked.length < 2) return;
      var w = opts.width(src.key), pc = !opts.phone();
      var same = marked.every(function (it) { return opts.width(it.key) === w; });
      // The marks go first: apply() draws the page again, without the orange frames.
      marks = []; source = null;
      // Already one width: nothing changes (and nothing to save).
      if (same) { opts.redraw(); opts.status(A.same, true); return; }
      opts.apply(marked.map(function (it) { return it.key; }), w);
      var msg = w ? A.done.replace("{n}", marked.length).replace("{w}", w) : A.doneAuto.replace("{n}", marked.length);
      if (opts.pairs && pc && w && w <= 53) msg += " " + A.pairs;
      opts.status(msg.replace(/\.$/, "")); // no full stop before the editor's " · unsaved"
    }
    return {
      has: has,
      button: function (key) {
        var on = has(key);
        var b = button(on ? A.unmark : A.mark, function () {
          var at = marks.indexOf(key);
          if (at >= 0) marks.splice(at, 1); else marks.push(key);
          opts.redraw();
        }, "pe-btn pe-align-btn");
        b.setAttribute("aria-pressed", String(on));
        return b;
      },
      mark: function (node, key) { if (node) node.classList.toggle("pe-marked", has(key)); },
      bar: function () {
        var marked = present();
        if (!marked.length) return null;
        var clear = button(A.clear, function () { marks = []; source = null; opts.redraw(); }, "pe-btn");
        var bar = el("div", { "class": "pe-tools pe-align-bar", role: "group", "aria-label": A.go, "data-align": opts.id || "" });
        if (marked.length < 2) {
          bar.appendChild(el("span", { "class": "pe-tools-label", text: A.one }));
          bar.appendChild(clear);
          return bar;
        }
        if (!marked.some(function (it) { return it.key === source; })) source = marked[0].key;
        var pc = !opts.phone();
        bar.appendChild(el("span", { "class": "pe-tools-label", text: (pc ? A.barPc : A.barPhone).replace("{n}", marked.length) }));
        var sel = el("select", { "class": "pe-select", "aria-label": A.source, title: A.source });
        marked.forEach(function (it, i) {
          var w = opts.width(it.key);
          var o = el("option", { value: String(i), text: short(it.name) + " · " + (w ? w + "%" : A.auto) });
          if (it.key === source) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () { var it = marked[Number(sel.value)]; if (it) source = it.key; opts.redraw(); });
        bar.appendChild(sel);
        bar.appendChild(button(A.go, match, "pe-btn pe-primary"));
        bar.appendChild(clear);
        var w = opts.width(source);
        if (opts.pairs && pc && w && w <= 53) bar.appendChild(el("p", { "class": "pe-align-warn", role: "status", text: A.pairs }));
        return bar;
      },
    };
  }

  window.BubaCore = {
    version: VERSION, liveWidth: liveWidth, rowWidths: rowWidths, fillRow: fillRow, saveFiles: saveFiles, saveErrorText: saveErrorText, blobSha: blobSha, shrinkImage: shrinkImage, shrinkImages: shrinkImages,
    el: el, button: button, token: token,
    utf8ToB64: utf8ToB64, b64ToUtf8: b64ToUtf8, readB64: readB64,
    github: github, loadStyles: loadStyles, history: history, siteWatch: siteWatch,
    describe: describe, captionDialog: captionDialog, capNode: capNode, placeCap: placeCap, frame: frame,
    aligner: aligner,
  };
})();

/*
 * BubaPix: text style for the on-page editors (owner only).
 *
 * Loaded by the editors (home, projects page, project pages, text pages)
 * when the owner edits; never by visitors. A text that can be styled has
 * data-ts="<page>/<kind>" (written by src/render.js). Clicking it while
 * editing opens a bar at the bottom of the screen: size, alignment, spacing
 * and font. A style applies to every text of that kind on the page (all
 * service names, for example) and to both languages. Alignment is start /
 * centre / end, so it mirrors between Hebrew and English.
 *
 * Styles are kept in content/styles.json and saved with the editor's own
 * "Save" (the editor calls BubaStyle.save()). The build turns them into
 * classes (src/text-style.js, css/styles.css), the same classes used here.
 */
(function () {
  "use strict";
  if (window.BubaStyle) return;

  var launcher = document.querySelector("[data-page-editor]");
  var REPO = launcher ? launcher.getAttribute("data-repo") : "";
  var BRANCH = launcher ? launcher.getAttribute("data-branch") : "";
  var API = "https://api.github.com/repos/" + REPO;
  var FILE = "content/styles.json";
  var he = document.documentElement.lang === "he";

  var T = he ? {
    bar: "עיצוב הטקסט", what: "עיצוב:", many: "חל על {n} טקסטים מאותו סוג בדף", one: "חל על הטקסט הזה ועל אותו טקסט בדף באנגלית",
    smaller: "A−", bigger: "A+", smallerTip: "הקטנת הטקסט", biggerTip: "הגדלת הטקסט",
    start: "ימין", center: "מרכז", end: "שמאל", alignTip: "יישור (בדף באנגלית הצדדים מתהפכים)",
    lessSpace: "רווח −", moreSpace: "רווח +", spaceTip: "הרווח מעל הטקסט ומתחתיו",
    font: "גופן", fontDefault: "רגיל", reset: "איפוס", resetTip: "חזרה לעיצוב הרגיל של הטקסט הזה",
    undo: "↶", undoTip: "ביטול שינוי העיצוב האחרון", close: "סגירה",
    note: "השינוי נשמר עם ״שמירה״.",
  } : {
    bar: "Text style", what: "Style:", many: "Applies to {n} texts of this kind on the page", one: "Applies to this text and the same text on the Hebrew page",
    smaller: "A−", bigger: "A+", smallerTip: "Smaller text", biggerTip: "Bigger text",
    start: "Left", center: "Centre", end: "Right", alignTip: "Alignment (on the Hebrew page the sides swap)",
    lessSpace: "Space −", moreSpace: "Space +", spaceTip: "The space above and below the text",
    font: "Font", fontDefault: "Usual", reset: "Reset", resetTip: "Back to this text's usual look",
    undo: "↶", undoTip: "Undo the last style change", close: "Close",
    note: "Saved with \"Save\".",
  };
  // The same lists as src/text-style.js.
  var SIZES = ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8", "z9", "z10", "z11"];
  var FONTS = [["heebo", "Heebo"], ["rubik", "Rubik"], ["assistant", he ? "אסיסטנט" : "Assistant"], ["frank", he ? "פרנק ריהל" : "Frank Ruhl Libre"], ["secular", he ? "סקולר" : "Secular One"], ["varela", he ? "ורלה עגול" : "Varela Round"], ["amatic", he ? "אמטיק (כתב יד)" : "Amatic SC"], ["suez", he ? "סואץ" : "Suez One"]];
  var KINDS = /^ts-(z\d+|a-(start|center|end)|sp-(m1|1|2)|f-[a-z]+)$/;

  function classesFor(st) {
    var out = [];
    if (!st) return out;
    if (SIZES.indexOf(st.size) >= 0) out.push("ts-" + st.size);
    if (["start", "center", "end"].indexOf(st.align) >= 0) out.push("ts-a-" + st.align);
    if ([-1, 1, 2].indexOf(st.space) >= 0) out.push(st.space < 0 ? "ts-sp-m1" : "ts-sp-" + st.space);
    if (FONTS.some(function (f) { return f[0] === st.font; })) out.push("ts-f-" + st.font);
    return out;
  }

  // ---------- GitHub ----------
  function token() {
    try { var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null"); if (u && typeof u.token === "string" && u.token) return u.token; } catch (e) { /* storage blocked */ }
    return "";
  }
  function api(path, opts) {
    opts = opts || {};
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "token " + token() };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (res) { return res.text().then(function (txt) { var d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = null; } if (!res.ok) { var err = new Error("GitHub " + res.status); err.status = res.status; throw err; } return d; }); });
  }
  function utf8ToB64(str) { var bytes = new TextEncoder().encode(str), bin = ""; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function b64ToUtf8(b64) { var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  var path = "/contents/" + FILE.split("/").map(encodeURIComponent).join("/");
  var ref = "?ref=" + encodeURIComponent(BRANCH);

  // ---------- state ----------
  var state = {}, original = "{}", sha = "", started = false, onChange = function () {};
  var past = [];
  function snap() { return JSON.stringify(state); }
  function each(key, fn) { Array.prototype.forEach.call(document.querySelectorAll('[data-ts="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]'), fn); }
  function paint(node) {
    var key = node.getAttribute("data-ts");
    Array.prototype.slice.call(node.classList).forEach(function (c) { if (KINDS.test(c)) node.classList.remove(c); });
    classesFor(state[key]).forEach(function (c) { node.classList.add(c); });
  }
  function paintAll() { Array.prototype.forEach.call(document.querySelectorAll("[data-ts]"), paint); }

  // ---------- the bar ----------
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
  function btn(label, title, fn, extra) { return el("button", { type: "button", "class": "ts-btn" + (extra ? " " + extra : ""), title: title || label, "aria-label": title || label, text: label, onclick: fn }); }
  var current = null; // { key, node }
  var what = el("span", { "class": "ts-what" });
  var fontBtn = btn(T.font + " ▾", T.font, function () { fontMenu.hidden = !fontMenu.hidden; fontBtn.setAttribute("aria-expanded", String(!fontMenu.hidden)); }, "ts-font-btn");
  fontBtn.setAttribute("aria-expanded", "false");
  var fontMenu = el("div", { "class": "ts-font-menu", role: "group", "aria-label": T.font }, [btn(T.fontDefault, T.fontDefault, function () { set("font", null); fontMenu.hidden = true; }, "ts-font-item")].concat(FONTS.map(function (f) {
    return btn(f[1], f[1], function () { set("font", f[0]); fontMenu.hidden = true; }, "ts-font-item ts-f-" + f[0]);
  })));
  fontMenu.hidden = true;
  var aligns = ["start", "center", "end"].map(function (a) { var b = btn(T[a], T.alignTip, function () { set("align", current && state[current.key] && state[current.key].align === a ? null : a); }, "ts-align"); b.setAttribute("data-align", a); return b; });
  var undoBtn = btn(T.undo, T.undoTip, undo, "ts-undo");
  var bar = el("div", { "class": "ts-bar", role: "toolbar", "aria-label": T.bar }, [
    el("div", { "class": "ts-row" }, [
      what,
      el("span", { "class": "ts-group", dir: "ltr" }, [btn(T.smaller, T.smallerTip, function () { size(-1); }, "ts-smaller"), btn(T.bigger, T.biggerTip, function () { size(1); }, "ts-bigger")]),
      el("span", { "class": "ts-group" }, aligns),
      el("span", { "class": "ts-group" }, [btn(T.lessSpace, T.spaceTip, function () { space(-1); }, "ts-less"), btn(T.moreSpace, T.spaceTip, function () { space(1); }, "ts-more")]),
      el("span", { "class": "ts-group ts-font-wrap" }, [fontBtn, fontMenu]),
      el("span", { "class": "ts-group" }, [undoBtn, btn(T.reset, T.resetTip, reset, "ts-reset"), btn("✕ " + T.close, T.close, hide, "ts-close")]),
    ]),
    el("p", { "class": "ts-note" }),
  ]);
  bar.hidden = true;

  function show(node) {
    var key = node.getAttribute("data-ts");
    if (current && current.node !== node) current.node.classList.remove("ts-current");
    current = { key: key, node: node };
    node.classList.add("ts-current");
    var n = document.querySelectorAll('[data-ts="' + key + '"]').length;
    what.textContent = T.what;
    bar.querySelector(".ts-note").textContent = (n > 1 ? T.many.replace("{n}", n) : T.one) + " " + T.note;
    bar.hidden = false;
    document.documentElement.classList.add("ts-open");
    refresh();
  }
  function hide() {
    if (current) current.node.classList.remove("ts-current");
    current = null; bar.hidden = true; fontMenu.hidden = true;
    document.documentElement.classList.remove("ts-open");
  }
  function refresh() {
    if (!current) return;
    var st = state[current.key] || {};
    aligns.forEach(function (b) { b.setAttribute("aria-pressed", String(st.align === b.getAttribute("data-align"))); });
    var f = FONTS.filter(function (x) { return x[0] === st.font; })[0];
    fontBtn.textContent = T.font + ": " + (f ? f[1] : T.fontDefault) + " ▾";
    Array.prototype.forEach.call(fontMenu.querySelectorAll("button"), function (b, i) { b.setAttribute("aria-pressed", String(i === 0 ? !st.font : FONTS[i - 1][0] === st.font)); });
    undoBtn.disabled = !past.length;
  }
  function set(prop, value) {
    if (!current) return;
    past.push(snap()); if (past.length > 100) past.shift();
    var st = Object.assign({}, state[current.key] || {});
    if (value === null || value === 0 || value === undefined) delete st[prop]; else st[prop] = value;
    if (Object.keys(st).length) state[current.key] = st; else delete state[current.key];
    each(current.key, paint);
    refresh(); onChange();
  }
  function undo() {
    if (!past.length) return;
    state = JSON.parse(past.pop());
    paintAll(); refresh(); onChange();
  }
  function reset() { if (current && state[current.key]) { past.push(snap()); delete state[current.key]; each(current.key, paint); refresh(); onChange(); } }
  // Sizes: one step up or down a fixed scale; the first step is the one
  // nearest to the text's size now.
  function sizePx(z) {
    var probe = el("span", { "class": "ts-" + z, "aria-hidden": "true" });
    probe.textContent = "x";
    probe.style.position = "absolute"; probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    var px = parseFloat(getComputedStyle(probe).fontSize) || 16;
    probe.remove();
    return px;
  }
  function size(dir) {
    if (!current) return;
    var st = state[current.key] || {}, i = SIZES.indexOf(st.size), next;
    if (i >= 0) next = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))];
    else {
      var now = parseFloat(getComputedStyle(current.node).fontSize) || 16;
      var list = SIZES.map(function (z) { return { z: z, px: sizePx(z) }; });
      var pick = dir > 0 ? list.filter(function (x) { return x.px > now + 0.5; })[0] : list.filter(function (x) { return x.px < now - 0.5; }).pop();
      next = pick ? pick.z : dir > 0 ? SIZES[SIZES.length - 1] : SIZES[0];
    }
    if (next !== st.size) set("size", next);
  }
  function space(dir) {
    if (!current) return;
    var now = (state[current.key] || {}).space || 0, next = Math.max(-1, Math.min(2, now + dir));
    if (next !== now) set("space", next || null);
  }

  // Clicking or moving into a styled text while editing chooses it.
  function choose(e) {
    if (!started) return;
    var t = e.target;
    if (!t || !t.closest || t.closest(".ts-bar, .pe-modal, .pe-bar, .pe-tools, .pe-tip")) return;
    var node = t.closest("[data-ts]");
    if (node) show(node);
    else if (e.type === "click" && current && !t.closest("button, a, input, select, label")) hide();
  }
  document.addEventListener("focusin", choose);
  document.addEventListener("click", choose);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !bar.hidden && !document.querySelector(".pe-modal")) { if (!fontMenu.hidden) fontMenu.hidden = true; else hide(); } });
  // Parts of the page that the editors draw again get their style again.
  new MutationObserver(function (list) {
    if (!started) return;
    list.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        if (n.hasAttribute("data-ts")) paint(n);
        Array.prototype.forEach.call(n.querySelectorAll ? n.querySelectorAll("[data-ts]") : [], paint);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  window.BubaStyle = {
    // Loads the saved styles. onChange: the editor's way to show "unsaved changes".
    start: function (opts) {
      opts = opts || {};
      if (opts.onChange) onChange = opts.onChange;
      if (started || !token() || !REPO) return Promise.resolve();
      return api(path + ref)
        .then(function (res) { sha = res.sha; return JSON.parse(b64ToUtf8(res.content) || "{}"); }, function (err) { if (err.status === 404) return {}; throw err; })
        .then(function (data) {
          state = data && typeof data === "object" && !Array.isArray(data) ? data : {};
          original = snap(); started = true;
          document.body.appendChild(bar);
          paintAll();
        });
    },
    dirty: function () { return started && snap() !== original; },
    // Saves the styles file (only when it changed); never over a file changed elsewhere.
    save: function (page) {
      if (!started || snap() === original) return Promise.resolve("");
      return api(path + ref)
        .then(function (res) { return res.sha; }, function (err) { if (err.status === 404) return ""; throw err; })
        .then(function (cur) {
          if (cur !== sha) { var err = new Error("changed"); err.changed = true; throw err; }
          var body = { message: "Text styles: edited on the page" + (page ? " (" + page + ")" : ""), content: utf8ToB64(JSON.stringify(state, null, 2) + "\n"), branch: BRANCH };
          if (sha) body.sha = sha;
          return api(path, { method: "PUT", body: body });
        })
        .then(function (res) { sha = res.content.sha; original = snap(); return res.commit && res.commit.sha || ""; });
    },
  };
})();

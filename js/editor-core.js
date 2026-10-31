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
 *   BubaCore.saveFiles(opts)                 saving: check every file first, then write (see below)
 *   BubaCore.version                         editors that need a newer copy load it again (a browser
 *                                            can keep an older copy of this file for a few minutes)
 */
(function () {
  "use strict";
  var VERSION = 2;
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
    var close = modal(T.caption, { closeText: T.close, body: [
      el("label", {}, [document.createTextNode(T.captionTitle), title]),
      el("label", {}, [document.createTextNode(T.captionNote), note]),
      el("label", {}, [document.createTextNode(T.captionWhere), where]),
      el("p", { "class": "pe-note", text: T.captionNoteHelp }),
      button(T.ok, function () {
        close();
        g[pre + "title_" + lang] = title.value.replace(/\s+/g, " ").trim();
        g[pre + "note_" + lang] = cleanText(note.value);
        g[pre + "caption"] = where.value;
        done();
      }, "pe-btn pe-primary"),
    ] }, title);
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
  // opts: api, branch,
  //   uploads: [{ path, file, message, done() }],
  //   files: [{ path, sha ("" = a new file), text (the whole file) or
  //             merge(currentData) -> data (only some fields change; the
  //             rest of the file as it is now), message, saved(newSha) }]
  // Resolves to { wrote }; on failure err.wrote says how many files were
  // already written (so the editor can say "some changes were saved").
  function saveFiles(opts) {
    var api = opts.api, ref = "?ref=" + encodeURIComponent(opts.branch);
    var enc = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
    var files = opts.files || [], uploads = opts.uploads || [];
    var wrote = 0;
    var changedErr = function () { var e = new Error("changed"); e.changed = true; return e; };
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
        chain = chain.then(function () { return readB64(u.file); })
          .then(function (b64) { return api("/contents/" + enc(u.path), { method: "PUT", body: { message: u.message, content: b64, branch: opts.branch } }); })
          .then(function () { if (u.done) u.done(); });
      });
      files.forEach(function (f, i) {
        chain = chain.then(function () {
          var text = f.merge ? JSON.stringify(f.merge(found[i].data), null, 2) + "\n" : f.text;
          var body = { message: f.message, content: utf8ToB64(text), branch: opts.branch };
          if (found[i].sha) body.sha = found[i].sha;
          return api("/contents/" + enc(f.path), { method: "PUT", body: body });
        }).then(function (res) {
          wrote++;
          if (f.saved) f.saved(res && res.content ? res.content.sha : "");
        });
      });
      return chain;
    }).then(function () { return { wrote: wrote }; }, function (err) { err.wrote = wrote; throw err; });
  }

  window.BubaCore = {
    version: VERSION, saveFiles: saveFiles,
    el: el, button: button, token: token,
    utf8ToB64: utf8ToB64, b64ToUtf8: b64ToUtf8, readB64: readB64,
    github: github, loadStyles: loadStyles, history: history, siteWatch: siteWatch,
    describe: describe, captionDialog: captionDialog, frame: frame,
  };
})();

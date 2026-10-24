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
 */
(function () {
  "use strict";
  if (window.BubaCore) return;

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

  window.BubaCore = {
    el: el, button: button, token: token,
    utf8ToB64: utf8ToB64, b64ToUtf8: b64ToUtf8, readB64: readB64,
    github: github, loadStyles: loadStyles, history: history, siteWatch: siteWatch,
  };
})();

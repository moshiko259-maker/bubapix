/*
 * BubaPix: "Earlier versions" for the on-page editors (owner only).
 *
 * Loaded only while the owner edits a page (the editor adds it from the
 * launcher's data-hist-src). Nothing here runs for visitors.
 *
 * It lists the last saves of a file (or of a folder, such as all the
 * project files) from the work branch's history on GitHub: when, and by
 * which tool (editing on the page, the admin panel, an automatic update).
 * Choosing one asks the editor to load that version into the page as a
 * change that is not saved yet; only "Save" makes it stay, and "Undo"
 * takes it back. Nothing is written here.
 *
 *   BubaHistory.open({
 *     api: function (path) -> Promise of the GitHub answer (the editor's own, with the owner's sign-in),
 *     path: "content/about.json" (or a folder: "content/projects"),
 *     paths: [ ... ]           (optional, instead of path: several files or folders together),
 *     branch: "redesign-v2",
 *     title: "Earlier versions of this page",
 *     note: "...",            (optional: what a version does and does not bring back)
 *     load: function (commitSha) -> Promise (the editor loads the files as they were then),
 *     onLoaded: function (),   (optional)
 *     onError: function ()     (optional)
 *   })
 */
(function () {
  "use strict";
  if (window.BubaHistory) return;
  var he = document.documentElement.lang === "he";
  var T = he ? {
    close: "סגירה",
    loading: "טוען גרסאות…",
    empty: "לא נמצאו גרסאות קודמות.",
    error: "לא הצלחתי לטעון את הגרסאות מ־GitHub.",
    use: "טעינת הגרסה הזאת",
    loadingOne: "טוען…",
    current: " (הנוכחית)",
    page: "עריכה על הדף",
    admin: "כלי הניהול",
    build: "עדכון אוטומטי",
    other: "שינוי",
    note: "בחירה בגרסה טוענת אותה לדף כשינוי שלא נשמר. רק ״שמירה״ קובעת. אפשר לבטל עם ״ביטול פעולה״.",
  } : {
    close: "Close",
    loading: "Loading versions…",
    empty: "No earlier versions found.",
    error: "Could not load the versions from GitHub.",
    use: "Load this version",
    loadingOne: "Loading…",
    current: " (current)",
    page: "Edited on the page",
    admin: "Admin panel",
    build: "Automatic update",
    other: "Change",
    note: "Choosing a version loads it onto the page as an unsaved change. Only \"Save\" makes it final. You can undo it.",
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function button(text, onClick, cls) {
    var b = el("button", { type: "button", "class": cls || "pe-btn", text: text });
    b.addEventListener("click", onClick);
    return b;
  }
  // Which tool made the save, from the commit message the editors and the admin panel write.
  function kindOf(message) {
    if (/on the (page|homepage|projects page|shop page)\b|^Upload picture/i.test(message)) return T.page;
    if (/^Rebuild/i.test(message)) return T.build;
    if (/^(Update|Create|Delete) |admin/i.test(message)) return T.admin;
    return T.other;
  }

  function open(opts) {
    var old = document.querySelector(".pe-hist-modal");
    if (old) old.remove();
    var listBox = el("div", { "class": "pe-hist-list" }, [el("p", { "class": "pe-note", text: T.loading })]);
    var closeBtn = button(T.close, function () { close(); }, "pe-btn pe-ghost");
    var dialog = el("div", { "class": "pe-modal pe-hist-modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title }, [
      el("div", { "class": "pe-modal-box pe-proj-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: opts.title }), closeBtn]),
        el("div", { "class": "pe-proj-scroll" }, [el("p", { "class": "pe-note", text: opts.note || T.note }), listBox]),
      ]),
    ]);
    var before = document.activeElement;
    function close() {
      dialog.remove();
      document.removeEventListener("keydown", onKey);
      if (before && before.focus) try { before.focus(); } catch (e) { /* gone */ }
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dialog);
    closeBtn.focus();
    var fmt;
    try { fmt = new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { fmt = null; }
    // One path, or several (paths): their saves together, newest first.
    var paths = opts.paths || [opts.path];
    Promise.all(paths.map(function (p) {
      return opts.api("/commits?path=" + encodeURIComponent(p) + "&sha=" + encodeURIComponent(opts.branch) + "&per_page=20");
    }))
      .then(function (lists) {
        if (lists.length === 1) return lists[0];
        var seen = {}, all = [];
        lists.forEach(function (l) { (Array.isArray(l) ? l : []).forEach(function (c) { if (c && c.sha && !seen[c.sha]) { seen[c.sha] = true; all.push(c); } }); });
        var when = function (c) { return c.commit && c.commit.committer && c.commit.committer.date || c.commit && c.commit.author && c.commit.author.date || ""; };
        all.sort(function (a, b) { return when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0; });
        return all.slice(0, 20);
      })
      .then(function (list) {
        listBox.textContent = "";
        if (!Array.isArray(list) || !list.length) { listBox.appendChild(el("p", { "class": "pe-note", text: T.empty })); return; }
        list.forEach(function (c, i) {
          var msg = (c.commit && c.commit.message || "").split("\n")[0];
          var when = c.commit && c.commit.author && c.commit.author.date ? new Date(c.commit.author.date) : null;
          var use = i === 0 ? null : button(T.use, function () {
            use.disabled = true; use.textContent = T.loadingOne;
            Promise.resolve(opts.load(c.sha))
              .then(function () { close(); if (opts.onLoaded) opts.onLoaded(); })
              .catch(function () { use.disabled = false; use.textContent = T.use; if (opts.onError) opts.onError(); });
          });
          listBox.appendChild(el("div", { "class": "pe-hist-row" }, [
            el("div", {}, [
              el("strong", { text: when ? (fmt ? fmt.format(when) : when.toLocaleString()) : "" }),
              el("span", { "class": "pe-note", text: " · " + kindOf(msg) + (i === 0 ? T.current : "") }),
            ]),
            use,
          ]));
        });
      })
      .catch(function () { listBox.textContent = ""; listBox.appendChild(el("p", { "class": "pe-note", text: T.error })); });
    return dialog;
  }

  window.BubaHistory = { open: open, kindOf: kindOf };
})();

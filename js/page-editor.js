/*
 * BubaPix: a general "edit on the page" for text pages (owner only).
 *
 * Loaded only when the owner presses "Edit on the page" (the edit bar shows
 * only in the owner's signed-in browser). Nothing here runs for visitors.
 *
 * The page template marks what can be edited, invisibly:
 *   data-ed-file="content/x.json"   the file the page's texts come from
 *   data-ed="field"                 a text: field_<lang> in that file
 *   data-ed-label="key"             an interface text: key_<lang> in content/labels.json
 *   data-ed-list="listField"        a list (services, steps…) in that file;
 *     data-ed-subs="name,text"      its texts; children: data-ed-item, data-ed-sub, data-ed-num
 * Texts are saved in the page's language only; everything else in the files
 * is kept exactly as it is. Saving writes to the work branch with the
 * owner's own GitHub sign-in, and never over a file changed elsewhere.
 */
(function () {
  "use strict";
  if (window.__bubapixPageEditor) return;
  window.__bubapixPageEditor = true;

  var launcher = document.querySelector("[data-page-editor]");
  var box = document.querySelector("[data-ed-file]");
  if (!launcher || !box) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var API = "https://api.github.com/repos/" + REPO;
  var FILE = box.getAttribute("data-ed-file");
  var LABELS = "content/labels.json";
  if (!/^content\/[a-z0-9-]+\.json$/.test(FILE || "")) return;
  var lang = document.documentElement.lang === "he" ? "he" : "en";
  var other = lang === "he" ? "en" : "he";
  var he = lang === "he";

  var T = he ? {
    title: "עריכת הדף", loading: "טוען את הדף…",
    save: "שמירה", saving: "שומר…", cancel: "יציאה בלי לשמור",
    saved: "נשמר. אתר הבדיקה יתעדכן (האתר החי לא משתנה).",
    unsaved: "יש שינויים שלא נשמרו", noChanges: "אין שינויים",
    undo: "ביטול פעולה", undoTip: "ביטול הפעולה האחרונה (Ctrl+Z)", nothingToUndo: "אין מה לבטל", undone: "הפעולה בוטלה",
    textHint: "לחצו כדי לכתוב", nameHint: "שם (לחצו כדי לכתוב)", bodyHint: "טקסט (לחצו כדי לכתוב)",
    introHint: "משפט פתיחה (לחצו כדי לכתוב, ריק = בלי משפט)",
    titleNote: "הכותרת הזו היא גם שם הכפתור בתפריט, בשפת הדף בלבד.",
    langNote: "כותבים כאן בעברית. עם ״תרגום אוטומטי לאנגלית״ (למעלה) האנגלית מתעדכנת בשמירה. לתיקון התרגום — פתחו את הדף באנגלית.",
    emptyBack: "הטקסט ריק, ולכן יוצג הטקסט הרגיל.",
    nameEmpty: "פריט בלי שם לא מוצג באתר (בשפה הזו).",
    notShown: "לא מוצג בדף בשפה הזו — חסר שם",
    add: "הוספה", remove: "מחיקה", earlier: "הזזה אחורה", later: "הזזה קדימה", drag: "גררו כדי לשנות את הסדר",
    removed: "נמחק. אפשר לבטל עם ״ביטול פעולה״.",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״פתיחת העריכה המתקדמת״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את הדף מ־GitHub.",
    errSave: "השמירה נכשלה. מה שלא נשמר — לא השתנה.",
    errChanged: "קובץ של הדף השתנה בינתיים במקום אחר (למשל בכלי הניהול או בעורך אחר). כדי לא למחוק את השינוי ההוא, לא שמרתי. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    publishing: "נשמר ✓ אתר הבדיקה מתעדכן. אפשר להמשיך לעבוד.",
    published: "האתר עודכן ✓", reload: "רעננו כדי לראות",
    slow: "העדכון לוקח יותר מהרגיל. השינוי שמור; אפשר לבדוק שוב מאוחר יותר.",
    tipTitle: "איך עורכים את הדף",
    tip1: "לוחצים על כל טקסט וכותבים: כותרת, משפט פתיחה, שמות ותיאורים.",
    tip2: "ברשימות: ״הוספה״ לפריט חדש, חצים או גרירה לשינוי הסדר, ״מחיקה״ להסרה.",
    tip3: "כל שינוי בסדר, הוספה או מחיקה — חל על שתי השפות.",
    tip4: "שום דבר לא נשמר עד ״שמירה״. טעיתם? ״ביטול פעולה״.",
    tipClose: "הבנתי", help: "עזרה",
    autoTr: "תרגום אוטומטי לאנגלית", autoTrTip: "בשמירה, כל טקסט ששיניתם כאן מתורגם לאנגלית ומחליף את הטקסט באנגלית. כבו כשאתם מתקנים תרגום.",
    translating: "מתרגם לאנגלית…",
    trDone: "תורגם לאנגלית: {n}. לתיקון — פתחו את הדף באנגלית, וכבו שם את ״תרגום אוטומטי״ לפני השמירה.",
    trFail: "התרגום לאנגלית לא הצליח (אולי נגמרה המכסה היומית החינמית, או שאין אינטרנט). העברית נשמרה; האנגלית לא השתנתה.",
    tip5: "״תרגום אוטומטי״ מתרגם בשמירה כל טקסט ששיניתם לשפה השנייה (חינם). מתקנים תרגום? כבו אותו לפני השמירה.",
  } : {
    title: "Editing the page", loading: "Loading the page…",
    save: "Save", saving: "Saving…", cancel: "Leave without saving",
    saved: "Saved. The test site will update (the live site does not change).",
    unsaved: "Unsaved changes", noChanges: "No changes",
    undo: "Undo", undoTip: "Undo the last action (Ctrl+Z)", nothingToUndo: "Nothing to undo", undone: "Undone",
    textHint: "Click to write", nameHint: "Name (click to write)", bodyHint: "Text (click to write)",
    introHint: "Opening line (click to write; empty = no line)",
    titleNote: "This title is also the menu button's name, in this language only.",
    langNote: "You write in English here. With \"Auto-translate to Hebrew\" (above) the Hebrew updates on saving. To fix the translation, open the page in Hebrew.",
    emptyBack: "The text is empty, so the usual text will show.",
    nameEmpty: "An item without a name is not shown on the site (in this language).",
    notShown: "Not shown in this language — no name",
    add: "Add", remove: "Delete", earlier: "Move earlier", later: "Move later", drag: "Drag to change the order",
    removed: "Deleted. You can undo it.",
    signIn: "To edit, sign in once to the admin panel in this browser (\"All management\" → \"Open advanced editing\"), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the page from GitHub.",
    errSave: "Saving failed. What was not saved did not change.",
    errChanged: "A file of this page was changed elsewhere in the meantime (for example in the admin panel or another editor). To keep that change, nothing was saved. Leave editing, reload the page and try again.",
    errAuth: "The sign-in expired or has no permission. Sign in to the admin panel again and retry.",
    leave: "There are unsaved changes. Leave anyway?",
    publishing: "Saved ✓ The test site is updating. You can keep working.",
    published: "The site is updated ✓", reload: "Reload to see it",
    slow: "The update is taking longer than usual. The change is saved; check again later.",
    tipTitle: "How to edit the page",
    tip1: "Click any text and write: title, opening line, names and descriptions.",
    tip2: "In lists: \"Add\" for a new item, arrows or dragging to reorder, \"Delete\" to remove.",
    tip3: "Reordering, adding or deleting applies to both languages.",
    tip4: "Nothing is saved until \"Save\". Made a mistake? \"Undo\".",
    tipClose: "Got it", help: "Help",
    autoTr: "Auto-translate to Hebrew", autoTrTip: "On saving, every text you changed here is translated to Hebrew and replaces the Hebrew text. Turn off when you fix a translation.",
    translating: "Translating to Hebrew…",
    trDone: "Translated to Hebrew: {n}. To fix it, open the page in Hebrew and turn off \"Auto-translate\" there before saving.",
    trFail: "Translating to Hebrew failed (maybe the free daily allowance ran out, or there is no internet). The English is saved; the Hebrew did not change.",
    tip5: "\"Auto-translate\" translates every text you changed into the other language when saving (free). Fixing a translation? Turn it off before saving.",
  };

  // ---------- small helpers ----------
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
    return el("button", { type: "button", "class": cls || "pe-btn", text: label, title: title || label, "aria-label": title || label, onclick: onClick });
  }
  function token() {
    try { var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null"); if (u && typeof u.token === "string" && u.token) return u.token; } catch (e) { /* storage blocked */ }
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
  var lastCommit = "";
  function api(path, opts) {
    opts = opts || {};
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "token " + token() };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
          if (!res.ok) { var err = new Error("GitHub " + res.status); err.status = res.status; throw err; }
          if (opts.method === "PUT" && data && data.commit && data.commit.sha) lastCommit = data.commit.sha;
          return data;
        });
      });
  }
  var encPath = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
  var ref = "?ref=" + encodeURIComponent(BRANCH);
  var styleLink = document.querySelector('link[href*="css/styles.css"]');
  var BASE = styleLink ? styleLink.getAttribute("href").split("css/styles.css")[0] : "";
  function clean(text) { return String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }

  // ---------- state ----------
  var state = null, original = "", sha = "", labelsSha = "";
  var snap = function () { return JSON.stringify(state); };
  var dirty = function () { return !!state && snap() !== original; };

  // ---------- toolbar ----------
  var status = el("span", { "class": "pe-status", role: "status", "aria-live": "polite" });
  var saveBtn = button(T.save, save, "pe-btn pe-primary");
  var undoBtn = button("↶ " + T.undo, undo, "pe-btn", T.undoTip);
  undoBtn.disabled = true;
  var TR_KEY = "bubapix-auto-translate-" + lang, trOn = true;
  try { trOn = localStorage.getItem(TR_KEY) !== "0"; } catch (e) { trOn = true; }
  var trBox = el("input", { type: "checkbox", "data-auto-translate": "" });
  trBox.checked = trOn;
  trBox.addEventListener("change", function () { try { localStorage.setItem(TR_KEY, trBox.checked ? "1" : "0"); } catch (e) { /* storage blocked */ } });
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }, [
      button("? " + T.help, function () { showTip(true); }, "pe-btn pe-ghost"),
      el("label", { "class": "pe-check pe-autotr", title: T.autoTrTip }, [trBox, el("span", { text: T.autoTr })]),
    ]),
    status,
    el("span", { "class": "pe-bar-actions" }, [undoBtn, saveBtn, button(T.cancel, quit, "pe-btn pe-ghost")]),
  ]);
  document.body.insertBefore(bar, document.body.firstChild);
  document.documentElement.classList.add("page-editing");
  setStatus(T.loading);
  saveBtn.disabled = true;
  function setStatus(text, kind) { status.textContent = text || ""; status.className = "pe-status" + (kind ? " is-" + kind : ""); }
  function refreshStatus() { setStatus(dirty() ? T.unsaved : T.noChanges, dirty() ? "warn" : ""); saveBtn.disabled = !dirty(); }

  // ---------- undo ----------
  var past = [], last = "";
  function commit() {
    if (!state) return;
    var now = snap();
    if (last && now !== last) { past.push(last); if (past.length > 100) past.shift(); }
    last = now;
    undoBtn.disabled = !past.length;
  }
  function undo() {
    if (!past.length) { setStatus(T.nothingToUndo); return; }
    state = JSON.parse(past.pop());
    last = snap();
    undoBtn.disabled = !past.length;
    fill(); drawLists(); refreshStatus();
    if (dirty()) setStatus(T.undone + " · " + T.unsaved, "warn");
  }
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    var typing = e.target && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z" && !typing) { e.preventDefault(); undo(); }
  });
  function changed() { commit(); drawLists(); refreshStatus(); }

  if (!token()) {
    setStatus("");
    bar.insertBefore(el("span", { "class": "pe-signin" }, [document.createTextNode(T.signIn + " "), el("a", { href: launcher.getAttribute("data-manage") || "#", text: T.openManage })]), status);
    return;
  }

  var getFile = function (path) {
    return api("/contents/" + encPath(path) + ref)
      .then(function (res) { return { sha: res.sha, data: JSON.parse(b64ToUtf8(res.content) || "{}") }; })
      .catch(function (err) { if (err.status === 404) return { sha: "", data: {} }; throw err; });
  };
  Promise.all([getFile(FILE), getFile(LABELS)])
    .then(function (r) {
      sha = r[0].sha; labelsSha = r[1].sha;
      state = { file: r[0].data || {}, labels: r[1].data || {} };
      original = snap();
      start();
      last = snap();
      refreshStatus();
      watchSite();
      showTip(false);
    })
    .catch(function (err) { setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error"); });

  var leaving = false;
  window.addEventListener("beforeunload", function (e) { if (!leaving && dirty()) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- texts ----------
  var parts = []; // { node, get } — refilled after undo
  function editable(node, hint, onText, onBlur) {
    try { node.contentEditable = "plaintext-only"; } catch (e) { node.contentEditable = "true"; }
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.classList.add("pe-editable");
    node.setAttribute("data-placeholder", hint);
    node.setAttribute("title", hint);
    node.addEventListener("input", function () { onText(clean(node.innerText)); refreshStatus(); });
    node.addEventListener("keydown", function (e) { if (e.key === "Enter" && !node.hasAttribute("data-multiline")) { e.preventDefault(); node.blur(); } });
    node.addEventListener("blur", function () { if (onBlur) onBlur(); commit(); });
    node.addEventListener("click", function (e) { e.preventDefault(); }, true);
  }
  function fieldPart(node) {
    var key = node.getAttribute("data-ed") + "_" + lang;
    parts.push({ node: node, get: function () { return state.file[key] || ""; } });
    editable(node, node.classList.contains("lede") ? T.introHint : T.textHint, function (v) { state.file[key] = v; });
  }
  function labelPart(node) {
    var key = node.getAttribute("data-ed-label") + "_" + lang, usual = node.textContent;
    parts.push({ node: node, get: function () { return state.labels[key] || usual; } });
    editable(node, T.textHint, function (v) { if (v) state.labels[key] = v; else delete state.labels[key]; }, function () {
      if (!state.labels[key]) { node.textContent = usual; setStatus(T.emptyBack, "warn"); }
    });
    if (node.tagName === "H1") node.parentNode.insertBefore(el("p", { "class": "pe-note pe-title-note", text: T.titleNote }), node.nextSibling);
  }
  function fill() { parts.forEach(function (p) { if (document.activeElement !== p.node) p.node.textContent = p.get(); }); }

  // ---------- lists ----------
  var lists = []; // { node, field, subs, tpl }
  function start() {
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed-label]"), labelPart);
    // An opening line that is empty today still gets a place to write it.
    if (!box.querySelector('[data-ed="intro"]')) {
      var head = box.querySelector(".page-head");
      if (head && "intro_" + lang in state.file) head.appendChild(el("p", { "class": "lede", "data-ed": "intro" }));
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed]"), function (n) { if (!n.closest("[data-ed-list]")) fieldPart(n); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed-list]"), function (n) {
      var tpl = n.querySelector("[data-ed-item]");
      lists.push({ node: n, field: n.getAttribute("data-ed-list"), subs: (n.getAttribute("data-ed-subs") || "name").split(","), tpl: tpl ? tpl.cloneNode(true) : el("li") });
    });
    var hd = box.querySelector(".page-head");
    if (hd) hd.parentNode.insertBefore(el("p", { "class": "pe-note pe-proj-note", text: T.langNote }), hd.nextSibling);
    drawLists();
  }
  var dragFrom = null;
  function drawLists() {
    lists.forEach(function (L) {
      var items = Array.isArray(state.file[L.field]) ? state.file[L.field] : (state.file[L.field] = []);
      L.node.textContent = "";
      items.forEach(function (it, i) {
        var li = L.tpl.cloneNode(true);
        li.setAttribute("data-ed-item", String(i));
        li.classList.add("pe-item", "pe-list-item");
        li.setAttribute("draggable", "true");
        var num = li.querySelector("[data-ed-num]");
        if (num) num.textContent = String(i + 1);
        L.subs.forEach(function (sub, k) {
          var n = li.querySelector('[data-ed-sub="' + sub + '"]');
          if (!n) { n = el(k === 0 ? "h2" : "p", { "data-ed-sub": sub }); li.appendChild(n); }
          var key = sub + "_" + lang;
          n.textContent = it[key] || "";
          editable(n, k === 0 ? T.nameHint : T.bodyHint, function (v) { it[key] = v; }, function () { if (k === 0 && !it[key]) setStatus(T.nameEmpty, "warn"); });
        });
        if (!it[L.subs[0] + "_" + lang]) li.appendChild(el("span", { "class": "pe-missing", text: T.notShown }));
        var back = he ? "›" : "‹", fwd = he ? "‹" : "›";
        li.appendChild(el("div", { "class": "pe-tools pe-list-tools" }, [
          button(back, function () { move(L, i, -1); }, "pe-icon", T.earlier),
          button(T.remove, function () { items.splice(i, 1); changed(); setStatus(T.removed, "warn"); }, "pe-btn pe-danger"),
          button(fwd, function () { move(L, i, 1); }, "pe-icon", T.later),
        ]));
        // Dragging starts only from the item's frame, so selecting text with the mouse still works.
        li.addEventListener("mousedown", function (e) { li.draggable = !(e.target.isContentEditable || (e.target.closest && e.target.closest(".pe-tools"))); });
        li.addEventListener("mouseup", function () { li.draggable = true; });
        li.addEventListener("dragstart", function (e) {
          if (e.target && e.target.closest && (e.target.closest(".pe-tools") || e.target.isContentEditable)) { e.preventDefault(); return; }
          dragFrom = { L: L, i: i }; li.classList.add("is-dragging");
          try { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ }
        });
        li.addEventListener("dragend", function () { li.classList.remove("is-dragging"); dragFrom = null; });
        li.addEventListener("dragover", function (e) { if (dragFrom && dragFrom.L === L && dragFrom.i !== i) { e.preventDefault(); li.classList.add("is-target"); } });
        li.addEventListener("dragleave", function () { li.classList.remove("is-target"); });
        li.addEventListener("drop", function (e) {
          e.preventDefault(); li.classList.remove("is-target");
          if (!dragFrom || dragFrom.L !== L || dragFrom.i === i) return;
          var moved = items.splice(dragFrom.i, 1)[0];
          items.splice(i, 0, moved); // takes the target's place
          dragFrom = null; changed();
        });
        L.node.appendChild(li);
      });
      var addBox = L.node.nextElementSibling && L.node.nextElementSibling.classList.contains("pe-add") ? L.node.nextElementSibling : null;
      if (!addBox) {
        addBox = el("div", { "class": "pe-add" }, [button("+ " + T.add, function () {
          var blank = {};
          L.subs.forEach(function (sub) { blank[sub + "_he"] = ""; blank[sub + "_en"] = ""; });
          (Array.isArray(state.file[L.field]) ? state.file[L.field] : (state.file[L.field] = [])).push(blank);
          changed();
          var last = L.node.lastElementChild && L.node.lastElementChild.querySelector("[data-ed-sub]");
          if (last) last.focus();
        }, "pe-btn pe-primary")]);
        L.node.parentNode.insertBefore(addBox, L.node.nextSibling);
      }
    });
  }
  function move(L, i, dir) {
    var items = state.file[L.field], j = i + dir;
    if (j < 0 || j >= items.length) return;
    var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    changed();
  }

  // ---------- first-time tips ----------
  var TIP = "bubapix-page-editor-tip";
  function showTip(force) {
    var seen = false;
    try { seen = localStorage.getItem(TIP) === "1"; } catch (e) { seen = false; }
    if (seen && !force) return;
    var old = document.querySelector(".pe-tip");
    if (old) old.remove();
    var tip = el("div", { "class": "pe-tip", role: "note" }, [
      el("strong", { text: T.tipTitle }),
      el("ol", {}, [T.tip1, T.tip2, T.tip3, T.tip5, T.tip4].map(function (t) { return el("li", { text: t }); })),
      button(T.tipClose, function () { try { localStorage.setItem(TIP, "1"); } catch (e) { /* storage blocked */ } tip.remove(); }, "pe-btn pe-primary"),
    ]);
    bar.parentNode.insertBefore(tip, bar.nextSibling);
  }

  // ---------- after saving: is the test site updated yet? ----------
  var siteWatch = { available: false, savedCommit: "", timer: 0, started: 0 };
  function readVersion() {
    return fetch(BASE + "version.txt?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { return /^[0-9a-f]{40}$/.test(t.trim()) ? t.trim() : ""; }).catch(function () { return ""; });
  }
  function watchSite() { readVersion().then(function (v) { siteWatch.available = !!v; }); }
  function followSave(commitSha, note, warn) {
    var plus = note ? " " + note : "";
    if (!siteWatch.available || !commitSha) { setStatus(T.saved + plus, warn ? "warn" : "ok"); return; }
    siteWatch.savedCommit = commitSha; siteWatch.started = Date.now();
    setStatus(T.publishing + plus, warn ? "warn" : "ok");
    clearTimeout(siteWatch.timer);
    var check = function () {
      if (siteWatch.savedCommit !== commitSha) return;
      readVersion().then(function (live) {
        if (!live) return false;
        if (live === commitSha) return true;
        return api("/compare/" + commitSha + "..." + live).then(function (c) { return c && (c.status === "ahead" || c.status === "identical"); }).catch(function () { return false; });
      }).then(function (done) {
        if (siteWatch.savedCommit !== commitSha) return;
        if (done) {
          if (dirty()) { setStatus(T.published + " · " + T.unsaved, "warn"); return; }
          status.textContent = "";
          status.className = "pe-status is-ok";
          status.appendChild(document.createTextNode(T.published + " "));
          status.appendChild(button(T.reload, function () { leaving = true; location.reload(); }, "pe-btn"));
          return;
        }
        if (Date.now() - siteWatch.started > 15 * 60 * 1000) { setStatus(T.slow, "warn"); return; }
        siteWatch.timer = setTimeout(check, 20000);
      });
    };
    siteWatch.timer = setTimeout(check, 20000);
  }

  // ---------- automatic translation (free: MyMemory, no key, owner's browser only) ----------
  var TR_API = "https://api.mymemory.translated.net/get";
  var bytes = function (t) { return new TextEncoder().encode(t).length; };
  function chunks(text) {
    // The service takes up to 500 bytes at a time (a Hebrew letter is 2 bytes): split by sentences, then by words.
    var out = [], cur = "";
    String(text).split(/(?<=[.!?…:;])\s+|\n+/).forEach(function (sentence) {
      var parts = bytes(sentence) > 450 ? sentence.split(/\s+/) : [sentence];
      parts.forEach(function (w) {
        var next = cur ? cur + " " + w : w;
        if (bytes(next) > 450 && cur) { out.push(cur); cur = w; } else cur = next;
      });
    });
    if (cur) out.push(cur);
    return out;
  }
  var ADDED = [/https?:\/\//i, /www\./i, /\]\(/, /\*\*/, /[<>]/, /@[\w-]+\.[a-z]/i];
  function decode(t) { return new DOMParser().parseFromString(t, "text/html").documentElement.textContent; }
  var trCache = {};
  function translate(text) {
    if (trCache[text]) return Promise.resolve(trCache[text]);
    var chain = Promise.resolve([]);
    chunks(text).forEach(function (part) {
      chain = chain.then(function (done) {
        return fetch(TR_API + "?q=" + encodeURIComponent(part) + "&langpair=" + lang + "|" + other, { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var t = d && d.responseData && d.responseData.translatedText;
            if (!d || Number(d.responseStatus) !== 200 || d.quotaFinished || !t || /MYMEMORY WARNING/i.test(t)) throw new Error("translate");
            t = decode(t).trim();
            // The shared translation memory must not add links or formatting
            // that were not in the owner's text (they would be published).
            if (ADDED.some(function (re) { return re.test(t) && !re.test(part); })) throw new Error("translate");
            return done.concat(t);
          });
      });
    });
    return chain.then(function (list) { var t = clean(list.join(" ")); trCache[text] = t; return t; });
  }
  // Every text changed in this language since loading → its twin in the other language.
  function translateChanges() {
    var orig = JSON.parse(original), jobs = [];
    var suffix = "_" + lang;
    function scan(now, before) {
      Object.keys(now).forEach(function (k) {
        if (k.slice(-3) !== suffix || typeof now[k] !== "string" || !now[k] || now[k] === before[k]) return;
        jobs.push({ text: now[k], put: function (t) { now[k.slice(0, -3) + "_" + other] = t; } });
      });
    }
    scan(state.file, orig.file);
    scan(state.labels, orig.labels);
    lists.forEach(function (L) {
      var was = Array.isArray(orig.file[L.field]) ? orig.file[L.field] : [];
      (state.file[L.field] || []).forEach(function (it) {
        L.subs.forEach(function (sub) {
          var k = sub + suffix, v = it[k];
          // Unchanged texts (also after moving items around) are found among the texts loaded from the file.
          if (!v || was.some(function (o) { return o[k] === v; })) return;
          jobs.push({ text: v, put: function (t) { it[sub + "_" + other] = t; } });
        });
      });
    });
    if (!trBox.checked || !jobs.length) return Promise.resolve({ n: 0 });
    setStatus(T.translating);
    var chain = Promise.resolve(), results = [];
    jobs.forEach(function (j) { chain = chain.then(function () { return translate(j.text).then(function (t) { results.push(t); }); }); });
    // All or nothing: a half-translated page would mix languages.
    return chain.then(function () { jobs.forEach(function (j, i) { j.put(results[i]); }); return { n: jobs.length }; })
      .catch(function () { return { n: 0, failed: true }; });
  }

  // ---------- save ----------
  function save() {
    lastCommit = "";
    if (!dirty()) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    saveBtn.disabled = true;
    translateChanges().then(function (tr) { write(tr); });
  }
  function write(tr) {
    var note = tr.failed ? T.trFail : tr.n ? T.trDone.replace("{n}", tr.n) : "";
    if (tr.n) { commit(); fill(); drawLists(); }
    setStatus(T.saving);
    var orig = JSON.parse(original);
    var jobs = [];
    if (JSON.stringify(state.file) !== JSON.stringify(orig.file)) jobs.push({ path: FILE, data: state.file, get: function () { return sha; }, set: function (v) { sha = v; }, message: "Page " + FILE.replace(/^content\/|\.json$/g, "") + ": edited on the page" });
    if (JSON.stringify(state.labels) !== JSON.stringify(orig.labels)) jobs.push({ path: LABELS, data: state.labels, get: function () { return labelsSha; }, set: function (v) { labelsSha = v; }, message: "Page " + FILE.replace(/^content\/|\.json$/g, "") + ": texts edited on the page" });
    var wrote = 0;
    // First make sure no file changed elsewhere since it was loaded; only then write.
    Promise.all(jobs.map(function (j) { return api("/contents/" + encPath(j.path) + ref).then(function (r) { return r.sha; }).catch(function (err) { if (err.status === 404) return ""; throw err; }); }))
      .then(function (cur) {
        jobs.forEach(function (j, k) { if (cur[k] !== j.get()) { var err = new Error("changed"); err.changed = true; throw err; } });
        var chain = Promise.resolve();
        jobs.forEach(function (j) {
          chain = chain.then(function () {
            var body = { message: j.message, content: utf8ToB64(JSON.stringify(j.data, null, 2) + "\n"), branch: BRANCH };
            if (j.get()) body.sha = j.get();
            return api("/contents/" + encPath(j.path), { method: "PUT", body: body }).then(function (res) { j.set(res.content.sha); wrote++; });
          });
        });
        return chain;
      })
      .then(function () { original = snap(); saveBtn.disabled = true; followSave(lastCommit, note, tr.failed); })
      .catch(function (err) {
        saveBtn.disabled = false;
        if (wrote) { setStatus(T.errSave, "error"); return; }
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    leaving = true;
    location.reload();
  }
})();

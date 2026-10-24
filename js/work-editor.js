/*
 * BubaPix: editing the projects page on the page itself (owner only).
 *
 * Loaded only when the owner presses "Edit on the page" on the projects page
 * (the edit bar appears only in the owner's signed-in browser). Nothing here
 * runs for visitors.
 *
 * What it does, right on the page:
 *   - the page title and the line at the bottom (interface texts, in the
 *     page's language; the title is also the menu button's name),
 *   - the order of the projects (drag or arrows),
 *   - the size of each picture on computers (drag the dots), or of all at once,
 *   - replacing a project's picture (its cover) and its description for blind
 *     visitors.
 * It saves the changed files (content/labels.json and the changed
 * content/projects/<slug>.json) to the work branch with the owner's own GitHub
 * sign-in. Everything else in those files is kept exactly as it is.
 */
(function boot() {
  "use strict";
  // The parts all the editors share (js/editor-core.js, loaded first by js/main.js).
  // A page from before js/main.js did this (the browser can keep a page for
  // a few minutes after an update) loads only the editor: then the editor
  // loads the shared file itself and starts again.
  var core = window.BubaCore;
  if (!core) {
    var me = document.currentScript, lb = document.querySelector("[data-page-editor]");
    var coreSrc = (lb && lb.getAttribute("data-core-src")) || (me && me.src ? me.src.replace(/[^/]*$/, "editor-core.js?t=" + Date.now()) : "");
    if (!coreSrc || window.__bubapixCoreLoading) return;
    window.__bubapixCoreLoading = true;
    var cs = document.createElement("script");
    cs.src = coreSrc;
    cs.onload = function () { window.__bubapixCoreLoading = false; boot(); };
    cs.onerror = function () { window.__bubapixCoreLoading = false; cs.remove(); };
    document.head.appendChild(cs);
    return;
  }
  if (window.__bubapixPageEditor) return;
  window.__bubapixPageEditor = true;
  var el = core.el, button = core.button, token = core.token;
  var utf8ToB64 = core.utf8ToB64, b64ToUtf8 = core.b64ToUtf8, readB64 = core.readB64;

  var launcher = document.querySelector("[data-page-editor]");
  var pageBox = document.querySelector("[data-work-page]");
  if (!launcher || !pageBox) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var LABELS = "content/labels.json";
  var lang = document.documentElement.lang === "he" ? "he" : "en";
  var he = lang === "he";

  var T = he ? {
    title: "עריכת עמוד הפרויקטים",
    loading: "טוען את עמוד הפרויקטים…",
    save: "שמירה", saving: "שומר…", cancel: "יציאה בלי לשמור", close: "סגירה",
    saved: "נשמר. אתר הבדיקה יתעדכן (האתר החי לא משתנה).",
    unsaved: "יש שינויים שלא נשמרו", noChanges: "אין שינויים",
    undo: "ביטול פעולה", undoTip: "ביטול הפעולה האחרונה (Ctrl+Z)", nothingToUndo: "אין מה לבטל", undone: "הפעולה בוטלה",
    pageTitle: "כותרת העמוד (לחצו כדי לשנות)",
    titleNote: "הכותרת הזאת היא גם שם הכפתור בתפריט, בשפת הדף בלבד.",
    titleEmpty: "הכותרת לא יכולה להיות ריקה. הכותרת הקודמת הוחזרה.",
    hint: "השורה בתחתית העמוד (לחצו כדי לכתוב). ריק = הטקסט הרגיל.",
    orderNote: "הסדר כאן הוא גם הסדר של הפוסטרים בדף הבית ושל ״הפרויקט הקודם/הבא״.",
    sizeAll: "גודל כל התמונות במחשב", sizeAuto: "אוטומטי", perRow: "בשורה", sizeFree: "גודל חופשי",
    freeNote: "גודל: לוחצים על תמונה וגוררים נקודה כחולה. סדר: גוררים את התמונה או חצים.",
    phoneNote: "בטלפון הגודל נקבע אוטומטית. שינוי גודל — במחשב.",
    frameTip: "לחצו על התמונה כדי לבחור אותה, גררו את הנקודות כדי לשנות גודל, או גררו את התמונה כדי להזיז",
    widthLabel: "רוחב",
    earlier: "הזזה למקום הקודם", later: "הזזה למקום הבא", prevBtn: "→ קודם", nextBtn: "הבא ←", more: "⋯ עוד", drag: "גררו כדי לשנות את הסדר",
    replace: "החלפת התמונה", describe: "תיאור לעיוורים", noAlt: "אין תיאור לעיוורים",
    nameOn: "השם מתחת לתמונה: מוצג", nameOff: "השם מתחת לתמונה: לא מוצג",
    coverNote: "התמונה כאן היא תמונת השער של הפרויקט: היא מתחלפת גם בדף הפרויקט ובפוסטר בדף הבית.",
    pickTitle: "בחירת תמונה", pickUpload: "העלאה מהמחשב", pickLoading: "טוען תמונות…",
    altHe: "תיאור התמונה לעיוורים, עברית", altEn: "תיאור התמונה לעיוורים, אנגלית",
    altNew: "תמונה חדשה צריכה תיאור חדש. כתבו בקצרה מה רואים בתמונה (רשות, אפשר גם אחר כך).",
    altEdit: "כתבו בקצרה מה רואים בתמונה. קוראי מסך מקריאים את זה לגולשים עיוורים.",
    choose: "בחירה", ok: "אישור", newBadge: "חדשה",
    uploadNote: "תמונה שמעלים כאן נשמרת בתיקיית הפרויקט.",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״פתיחת העריכה המתקדמת״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את עמוד הפרויקטים מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא נשמר, והאתר לא השתנה.",
    errPartial: "חלק מהשינויים נשמרו וחלק לא. רעננו את הדף ובדקו.",
    errChanged: "אחד הקבצים של העמוד השתנה בינתיים במקום אחר (למשל בכלי הניהול או בעורך אחר). כדי לא למחוק את השינוי ההוא, לא שמרתי כלום. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    publishing: "נשמר ✓ אתר הבדיקה מתעדכן. אפשר להמשיך לעבוד.",
    published: "האתר עודכן ✓", reload: "רעננו כדי לראות",
    slow: "העדכון לוקח יותר מהרגיל. השינוי שמור; אפשר לבדוק שוב מאוחר יותר.",
    tipTitle: "איך עורכים את עמוד הפרויקטים",
    tip1: "לוחצים על הכותרת או על השורה בתחתית וכותבים.",
    tip2: "סדר: גוררים תמונה למקום אחר, או חצים. גודל: לוחצים על תמונה וגוררים נקודה כחולה; לכל התמונות יחד — ״גודל כל התמונות במחשב״.",
    tip3: "״החלפת התמונה״ מחליפה את תמונת השער של הפרויקט (גם בדף הפרויקט ובדף הבית).",
    tip4: "שום דבר לא נשמר עד ״שמירה״. טעיתם? ״ביטול פעולה״.",
    tipTouch: "בטלפון ובטאבלט: נוגעים בתמונה כדי לבחור אותה, והכלים (״→ קודם״, ״הבא ←״, החלפה, תיאור) מופיעים מתחתיה. נגיעה בתמונה לא משנה כלום בעצמה.",
    tipClose: "הבנתי", help: "עזרה",
    history: "גרסאות קודמות", historyLoaded: "גרסה קודמת נטענה לדף. בדקו ולחצו ״שמירה״ כדי לקבוע אותה.", historyFailed: "לא הצלחתי לטעון את הגרסה מ־GitHub.",
    historyTitle: "גרסאות קודמות של דף הפרויקטים",
    historyNote: "הרשימה כוללת כל שמירה של קובצי הפרויקטים. בחירה בגרסה מחזירה לדף את הסדר, הגדלים ותמונות השער (עם התיאורים שלהן) כפי שהיו, כשינוי שלא נשמר. רק ״שמירה״ קובעת. אפשר לבטל עם ״ביטול פעולה״. השם והתוכן של כל פרויקט, הכותרות וסגנונות הטקסט לא משתנים. פרויקט שלא היה קיים אז נשאר כמו שהוא.",
  } : {
    title: "Editing the projects page",
    loading: "Loading the projects page…",
    save: "Save", saving: "Saving…", cancel: "Leave without saving", close: "Close",
    saved: "Saved. The test site will update (the live site does not change).",
    unsaved: "Unsaved changes", noChanges: "No changes",
    undo: "Undo", undoTip: "Undo the last action (Ctrl+Z)", nothingToUndo: "Nothing to undo", undone: "Undone",
    pageTitle: "Page title (click to change)",
    titleNote: "This title is also the menu button's name, in this language only.",
    titleEmpty: "The title cannot be empty. The previous title is back.",
    hint: "The line at the bottom of the page (click to write). Empty = the usual text.",
    orderNote: "This order is also the order of the posters on the homepage and of \"previous/next project\".",
    sizeAll: "Size of all pictures on computers", sizeAuto: "Automatic", perRow: "per row", sizeFree: "Free size",
    freeNote: "Size: click a picture and drag a blue dot. Order: drag the picture or use the arrows.",
    phoneNote: "On phones the size is automatic. Resize on a computer.",
    frameTip: "Click the picture to select it, drag the dots to resize, or drag the picture to move it",
    widthLabel: "Width",
    earlier: "Move to the previous place", later: "Move to the next place", prevBtn: "← Earlier", nextBtn: "Later →", more: "⋯ More", drag: "Drag to change the order",
    replace: "Replace the picture", describe: "Description for blind visitors", noAlt: "No description for blind visitors",
    nameOn: "Name under the picture: shown", nameOff: "Name under the picture: not shown",
    coverNote: "The picture here is the project's cover: it also changes on the project page and on the homepage poster.",
    pickTitle: "Choose a picture", pickUpload: "Upload from this computer", pickLoading: "Loading pictures…",
    altHe: "Description for blind visitors, Hebrew", altEn: "Description for blind visitors, English",
    altNew: "A new picture needs a new description. Say briefly what the picture shows (optional, can be done later).",
    altEdit: "Say briefly what the picture shows. Screen readers read it to blind visitors.",
    choose: "Choose", ok: "OK", newBadge: "new",
    uploadNote: "A picture uploaded here is stored in the project's folder.",
    signIn: "To edit, sign in once to the admin panel in this browser (\"All management\" → \"Open advanced editing\"), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the projects page from GitHub.",
    errSave: "Saving failed. Nothing was saved, and the site did not change.",
    errPartial: "Some changes were saved and some were not. Reload the page and check.",
    errChanged: "One of this page's files was changed elsewhere in the meantime (for example in the admin panel or another editor). To keep that change, nothing was saved. Leave editing, reload the page and try again.",
    errAuth: "The sign-in expired or has no permission. Sign in to the admin panel again and retry.",
    leave: "There are unsaved changes. Leave anyway?",
    publishing: "Saved ✓ The test site is updating. You can keep working.",
    published: "The site is updated ✓", reload: "Reload to see it",
    slow: "The update is taking longer than usual. The change is saved; check again later.",
    tipTitle: "How to edit the projects page",
    tip1: "Click the title or the line at the bottom and write.",
    tip2: "Order: drag a picture to another place, or use the arrows. Size: click a picture and drag a blue dot; for all pictures at once, \"Size of all pictures on computers\".",
    tip3: "\"Replace the picture\" replaces the project's cover (also on the project page and the homepage).",
    tip4: "Nothing is saved until \"Save\". Made a mistake? \"Undo\".",
    tipTouch: "On phones and tablets: tap a picture to choose it, and its tools (\"← Earlier\", \"Later →\", replace, description) appear below it. A tap on a picture changes nothing by itself.",
    tipClose: "Got it", help: "Help",
    history: "Earlier versions", historyLoaded: "An earlier version is loaded on the page. Check it and press \"Save\" to keep it.", historyFailed: "Could not load the version from GitHub.",
    historyTitle: "Earlier versions of the projects page",
    historyNote: "The list includes every save of the project files. Choosing a version brings back the order, the sizes and the cover pictures (with their descriptions) as they were, as an unsaved change. Only \"Save\" makes it final. You can undo it. Each project's name and content, the titles and the text styles do not change. A project that did not exist then stays as it is.",
  };

  // ---------- small helpers ----------
  var lastCommit = "";
  var api = core.github(launcher, function (sha) { lastCommit = sha; }).api;
  var encPath = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
  var ref = "?ref=" + encodeURIComponent(BRANCH);
  var styleLink = document.querySelector('link[href*="css/styles.css"]');
  var BASE = styleLink ? styleLink.getAttribute("href").split("css/styles.css")[0] : "";
  var norm = function (p) { return String(p || "").replace(/^\//, ""); };
  var url = function (p) { return BASE + norm(p); };
  function clean(text) { return String(text || "").replace(/\r/g, "").replace(/\s+/g, " ").trim(); }

  // Pictures already on the page: reuse their small sizes and proportions.
  var known = {};
  Array.prototype.forEach.call(document.querySelectorAll("img"), function (img) {
    var src = img.getAttribute("src") || "";
    if (BASE && src.indexOf(BASE) === 0) src = src.slice(BASE.length);
    known[norm(src)] = { srcset: img.getAttribute("srcset") || "", w: Number(img.getAttribute("width")) || 0, h: Number(img.getAttribute("height")) || 0 };
  });
  var natural = {};
  function ratioOf(path) {
    var k = known[norm(path)], r = k && k.w && k.h ? k.w / k.h : natural[norm(path)] || 1.5;
    return Math.min(4, Math.max(0.4, Math.round(r * 100) / 100));
  }
  var uploads = {}; // path -> { file, blobUrl, done }
  function picture(path, sizes, onRatio) {
    var p = norm(path), img = el("img", { alt: "", loading: "lazy", decoding: "async" });
    if (uploads[p]) img.src = uploads[p].blobUrl;
    else {
      var k = known[p];
      if (k && k.srcset) { img.setAttribute("srcset", k.srcset); img.setAttribute("sizes", sizes || "40vw"); }
      img.src = url(p);
    }
    img.addEventListener("load", function () {
      if (!natural[p] && img.naturalWidth && img.naturalHeight) {
        natural[p] = img.naturalWidth / img.naturalHeight;
        if (onRatio && !(known[p] && known[p].w)) onRatio();
      }
    });
    return img;
  }

  // ---------- state ----------
  // labels: the interface texts file; projects: the projects shown on this
  // page, in the page's order (each with its file's data and version).
  var state = null, files = null, original = "";
  var snap = function () { return JSON.stringify(state); };
  // Text styles (js/text-style.js) are saved with the page too.
  var dirty = function () { return !!state && (snap() !== original || !!(window.BubaStyle && window.BubaStyle.dirty())); };
  var TITLE = "nav_work_" + lang, HINT = "work_hint_" + lang;


  // ---------- earlier versions (the shared js/history.js, loaded on first use) ----------
  var histBtn = button(T.history, openHistory, "pe-btn pe-ghost");
  histBtn.disabled = true;
  function openHistory() {
    core.history(launcher, {
      api: api, path: "content/projects", branch: BRANCH, title: T.historyTitle, note: T.historyNote, load: loadVersion,
      onLoaded: function () { setStatus(T.historyLoaded, "warn"); },
      onError: function () { setStatus(T.historyFailed, "error"); },
      onMissing: function () { setStatus(T.historyFailed, "error"); },
    });
  }
  // What this page sets in each project file (the rest of the file stays as it is now).
  var PAGE_FIELDS = ["order", "list_w", "cover", "cover_alt_he", "cover_alt_en", "title_in_gallery"];
  function loadVersion(commitSha) {
    return Promise.all(state.list.map(function (p) {
      var path = "content/projects/" + p.slug + ".json";
      return api("/contents/" + encPath(path) + "?ref=" + encodeURIComponent(commitSha))
        .then(function (res) { return JSON.parse(b64ToUtf8(res.content)); })
        .catch(function (err) { if (err.status === 404) return null; throw err; });
    })).then(function (olds) {
      var at = {};
      state.list.forEach(function (p, i) {
        at[p.slug] = i;
        var old = olds[i];
        if (!old || typeof old !== "object") return; // the project did not exist then
        PAGE_FIELDS.forEach(function (k) { if (old[k] === undefined) delete p.data[k]; else p.data[k] = old[k]; });
      });
      var num = function (p) { var n = Number(p.data.order); return isFinite(n) && n > 0 ? n : Infinity; };
      state.list.sort(function (a, b) { return num(a) - num(b) || at[a.slug] - at[b.slug]; });
      changed();
    });
  }

  // ---------- toolbar ----------
  var status = el("span", { "class": "pe-status", role: "status", "aria-live": "polite" });
  var saveBtn = button(T.save, save, "pe-btn pe-primary");
  var undoBtn = button("↶ " + T.undo, undo, "pe-btn", T.undoTip);
  undoBtn.disabled = true;
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }, [button("? " + T.help, function () { showTip(true); }, "pe-btn pe-ghost"), histBtn]),
    status,
    el("span", { "class": "pe-bar-actions" }, [undoBtn, saveBtn, button(T.cancel, quit, "pe-btn pe-ghost")]),
  ]);
  // Phones: one row of buttons; the other choices open with "More".
  (function () {
    var lay = bar.querySelector(".pe-bar-layout");
    if (!lay) return;
    lay.id = "pe-bar-more";
    var more = button(T.more, function () { var o = bar.classList.toggle("pe-bar-open"); more.setAttribute("aria-expanded", String(o)); }, "pe-btn pe-more");
    more.setAttribute("aria-expanded", "false"); more.setAttribute("aria-controls", "pe-bar-more");
    bar.insertBefore(more, lay);
  })();
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
    fillTexts(); render(); refreshStatus();
    if (dirty()) setStatus(T.undone + " · " + T.unsaved, "warn");
  }
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    var typing = e.target && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z" && !typing) { e.preventDefault(); undo(); }
  });
  function changed() { commit(); render(); refreshStatus(); }

  if (!token()) {
    setStatus("");
    bar.insertBefore(el("span", { "class": "pe-signin" }, [
      document.createTextNode(T.signIn + " "),
      el("a", { href: launcher.getAttribute("data-manage") || "#", text: T.openManage }),
    ]), status);
    return;
  }

  // The projects shown on the page, in order (from their links).
  var slugs = [];
  Array.prototype.forEach.call(pageBox.querySelectorAll("a.jg-item[href]"), function (a) {
    var m = (a.getAttribute("href") || "").match(/work\/([a-z0-9][a-z0-9-]*)\//);
    if (m && slugs.indexOf(m[1]) < 0) slugs.push(m[1]);
  });

  var loadLabels = api("/contents/" + encPath(LABELS) + ref)
    .then(function (res) { return { sha: res.sha, data: JSON.parse(b64ToUtf8(res.content) || "{}") }; })
    .catch(function (err) { if (err.status === 404) return { sha: "", data: {} }; throw err; });
  var loadProjects = Promise.all(slugs.map(function (slug) {
    var path = "content/projects/" + slug + ".json";
    return api("/contents/" + encPath(path) + ref).then(function (res) { return { slug: slug, path: path, sha: res.sha, data: JSON.parse(b64ToUtf8(res.content)) }; });
  }));
  Promise.all([loadLabels, loadProjects])
    .then(function (r) {
      files = { labels: { path: LABELS, sha: r[0].sha, data: r[0].data }, projects: {} };
      r[1].forEach(function (p) { files.projects[p.slug] = p; });
      state = { labels: r[0].data, list: r[1].map(function (p) { return { slug: p.slug, data: p.data }; }) };
      original = snap();
      start();
      histBtn.disabled = false;
      last = snap();
      refreshStatus();
      watchSite();
      showTip(false);
      loadStyles();
    })
    .catch(function (err) { setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error"); });
  function loadStyles() { core.loadStyles(launcher, refreshStatus); }

  var leaving = false;
  window.addEventListener("beforeunload", function (e) { if (!leaving && dirty()) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- page parts ----------
  var area = el("div", { "class": "pe-proj-area pe-work-area" });
  var titleEl = null, hintEl = null, titleBefore = "";
  function editable(node, placeholder, onText) {
    try { node.contentEditable = "plaintext-only"; } catch (e) { node.contentEditable = "true"; }
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.classList.add("pe-editable");
    node.setAttribute("data-placeholder", placeholder);
    node.setAttribute("role", "textbox");
    node.setAttribute("aria-label", placeholder);
    node.addEventListener("input", function () { onText(node.innerText.replace(/ /g, " ")); refreshStatus(); });
    node.addEventListener("blur", function () { commit(); });
    node.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); node.blur(); } });
  }
  function start() {
    var grid = pageBox.querySelector(".jg-work");
    if (grid) grid.hidden = true;
    var filters = pageBox.querySelector(".filters");
    if (filters) filters.hidden = true;
    var oldHint = pageBox.querySelector("[data-work-hint]");
    titleEl = pageBox.querySelector("[data-work-title]");
    if (titleEl) {
      titleBefore = titleEl.textContent;
      editable(titleEl, T.pageTitle, function (txt) { state.labels[TITLE] = clean(txt); });
      titleEl.addEventListener("blur", function () {
        if (!clean(state.labels[TITLE])) {
          var o = JSON.parse(original).labels[TITLE];
          if (o) state.labels[TITLE] = o; else delete state.labels[TITLE];
          titleEl.textContent = o || titleBefore;
          setStatus(T.titleEmpty, "warn");
        }
      });
      titleEl.parentNode.appendChild(el("p", { "class": "pe-note pe-title-note", text: T.titleNote }));
    }
    hintEl = el("p", { "class": "page-hint bottom-hint", "data-ts": "work/hint" });
    hintEl.textContent = state.labels[HINT] || (oldHint ? oldHint.textContent : "");
    editable(hintEl, T.hint, function (txt) { var v = clean(txt); if (v) state.labels[HINT] = v; else delete state.labels[HINT]; });
    if (oldHint) oldHint.hidden = true;
    if (grid) grid.parentNode.insertBefore(area, grid); else pageBox.appendChild(area);
    pageBox.appendChild(hintEl);
    render();
  }
  function fillTexts() {
    if (titleEl) titleEl.textContent = state.labels[TITLE] || titleBefore;
    if (hintEl) hintEl.textContent = state.labels[HINT] || "";
  }

  // ---------- drawing ----------
  var narrow = window.matchMedia ? window.matchMedia("(max-width: 700px)") : { matches: false };
  // Touch screens: a tap only chooses a picture; its tools then appear below it,
  // so a tap on a picture never changes anything by itself (U5).
  var touch = window.matchMedia ? window.matchMedia("(hover: none)") : { matches: false };
  var pickedKey = null;
  function touchPick(box, key) {
    if (key && pickedKey === key) box.classList.add("pe-picked");
    box.addEventListener("click", function (e) {
      // A button that redrew its own tools is no longer inside the picture: not a tap on it.
      if (!touch.matches || !box.contains(e.target) || (e.target.closest && e.target.closest(".pe-tools, .pe-dot, .pe-modal"))) return;
      var on = !box.classList.contains("pe-picked");
      Array.prototype.forEach.call(document.querySelectorAll(".pe-picked"), function (n) { n.classList.remove("pe-picked"); });
      if (on) box.classList.add("pe-picked");
      pickedKey = on ? key : null;
    });
  }
  if (narrow.addEventListener) narrow.addEventListener("change", function () { if (state) render(); });
  var selected = null, dragFrom = null;
  var widthOf = function (p) { var w = Number(p.data.list_w); return w >= 10 && w <= 100 ? w : 0; };
  function isFree() { return state.list.some(function (p) { return widthOf(p); }); }
  function sameWidth() {
    if (!isFree()) return "auto";
    for (var n = 1; n <= 4; n++) if (state.list.every(function (p) { return widthOf(p) === Math.floor(100 / n); })) return String(n);
    return "free";
  }
  // Same rule as the site (src/render.js freeClasses).
  function freeRows(list) {
    var rows = [], row = [], sum = 0;
    list.forEach(function (it) {
      var f = widthOf(it.p) || 33;
      if (row.length && sum + f > 106) { rows.push(row); row = []; sum = 0; }
      row.push(it); sum += f;
    });
    if (row.length) rows.push(row);
    rows.forEach(function (rw) {
      var f = rw.map(function (it) { return widthOf(it.p) || 33; });
      if (rw.length === 1) { rw[0].single = Math.min(100, f[0]); return; }
      var total = f.reduce(function (a, b) { return a + b; }, 0);
      var share = f.map(function (x) { return x / total; });
      var h = share.reduce(function (acc, sh, k) { return acc + sh * (sh * 100 / rw[k].r); }, 0);
      rw.forEach(function (it, k) { it.grow = Math.round(share[k] * 1000); it.ar = (share[k] * 100) / h; });
    });
    return rows;
  }
  function selectBox(label, value, options, onChange) {
    var sel = el("select", { "aria-label": label, title: label, "class": "pe-select" });
    options.forEach(function (o) { var opt = el("option", { value: o[0], text: o[1] }); if (String(value) === o[0]) opt.selected = true; sel.appendChild(opt); });
    sel.addEventListener("change", function () { onChange(sel.value); });
    return sel;
  }
  function render() {
    area.textContent = "";
    var per = sameWidth();
    area.appendChild(el("div", { "class": "pe-gal-tools" }, [
      el("label", { "class": "pe-gal-size" }, [
        document.createTextNode(T.sizeAll + " "),
        selectBox(T.sizeAll, per, [["auto", T.sizeAuto], ["1", "1 " + T.perRow], ["2", "2 " + T.perRow], ["3", "3 " + T.perRow], ["4", "4 " + T.perRow]].concat(per === "free" ? [["free", T.sizeFree]] : []), function (v) {
          state.list.forEach(function (p) { if (v === "auto") delete p.data.list_w; else if (v !== "free") p.data.list_w = Math.floor(100 / Number(v)); });
          changed();
        }),
      ]),
      el("span", { "class": "pe-note", text: narrow.matches ? T.phoneNote : T.freeNote }),
    ]));
    area.appendChild(el("p", { "class": "pe-note", text: T.orderNote }));
    var items = state.list.map(function (p, i) { return { p: p, i: i, r: ratioOf(p.data.cover) }; }).filter(function (it) { return it.p.data.cover; });
    var grid;
    if (isFree() && !narrow.matches) {
      grid = el("div", { "class": "jg-project jg-free pe-gal pe-work" });
      freeRows(items).forEach(function (row) {
        var r = el("div", { "class": "mrow n" + row.length });
        row.forEach(function (it) { r.appendChild(cell(it, grid)); });
        grid.appendChild(r);
      });
    } else {
      grid = el("div", { "class": "jg jg-work pe-gal pe-work" });
      items.forEach(function (it) { grid.appendChild(cell(it, grid)); });
    }
    area.appendChild(grid);
    area.appendChild(el("p", { "class": "pe-note", text: T.coverNote }));
  }
  function nameOf(p) { return (he ? p.data.title_he || p.data.title_en : p.data.title_en || p.data.title_he) || p.slug; }
  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.list.length) return;
    var tmp = state.list[i]; state.list[i] = state.list[j]; state.list[j] = tmp;
    changed();
  }
  function cell(it, grid) {
    var p = it.p, d = p.data, r = it.r;
    var media = el("span", { "class": "jg-media" }, [picture(d.cover, "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 40vw", redraw)]);
    media.style.aspectRatio = String(r);
    var fig = el("figure", { "class": "jg-item pe-item", draggable: "true", title: T.drag }, [media]);
    if (it.single) { fig.classList.add("pe-alone"); fig.style.width = it.single + "%"; }
    else if (it.grow) { fig.style.flex = it.grow + " 1 0"; fig.style.minWidth = "0"; media.style.aspectRatio = String(it.ar); media.classList.add("pe-crop"); }
    else { fig.style.flexGrow = String(Math.round(r * 100)); fig.style.flexBasis = "calc(var(--row-h) * " + r + ")"; }
    if (!narrow.matches) frame(fig, {
      start: function () { return fig.getBoundingClientRect().width / (grid.getBoundingClientRect().width || 1) * 100; },
      area: function () { return grid.getBoundingClientRect().width; },
      live: function (pct) { fig.style.flex = "none"; fig.style.width = pct + "%"; },
      done: function (pct) {
        // The first resize keeps every other picture at its current size.
        if (!isFree()) {
          var gw = grid.getBoundingClientRect().width || 1;
          Array.prototype.forEach.call(grid.querySelectorAll(".pe-item"), function (n) {
            if (n.__p && n.__p !== p) n.__p.data.list_w = Math.max(10, Math.min(100, Math.round(n.getBoundingClientRect().width / gw * 100)));
          });
        }
        d.list_w = pct; selected = p.slug; changed();
      },
      selectedNow: selected === p.slug,
    });
    fig.__p = p;
    if (uploads[norm(d.cover)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
    if (!d["cover_alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
    fig.appendChild(el("span", { "class": "pe-work-name", text: nameOf(p) }));
    touchPick(fig, p);
    fig.appendChild(el("div", { "class": "pe-tools" }, [
      button(T.prevBtn, function () { move(it.i, -1); }, "pe-btn pe-move", T.earlier),
      button(T.nextBtn, function () { move(it.i, 1); }, "pe-btn pe-move", T.later),
      button(T.replace, function () {
        pick(p.slug, function (path, alts) { d.cover = "/" + path; d.cover_alt_he = alts.he; d.cover_alt_en = alts.en; changed(); }, T.altNew);
      }),
      button(T.describe, function () {
        describe(d.cover_alt_he, d.cover_alt_en, function (alts) { d.cover_alt_he = alts.he; d.cover_alt_en = alts.en; changed(); });
      }),
      // The project's name under its picture on this page (title_in_gallery; off unless chosen).
      button(d.title_in_gallery === true ? T.nameOn : T.nameOff, function () {
        if (d.title_in_gallery === true) delete d.title_in_gallery; else d.title_in_gallery = true;
        changed();
      }, "pe-btn pe-name-btn"),
    ]));
    if (d.title_in_gallery === true && nameOf(p)) fig.insertBefore(el("figcaption", { "class": "jg-caption pe-caption" }, [el("span", { "class": "jg-title", text: nameOf(p) })]), media.nextSibling);
    fig.addEventListener("dragstart", function (e) {
      if (e.target && e.target.closest && e.target.closest(".pe-tools, .pe-dot")) { e.preventDefault(); return; }
      dragFrom = p; fig.classList.add("is-dragging");
      try { e.dataTransfer.setData("text/plain", p.slug); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ }
    });
    fig.addEventListener("dragend", function () { fig.classList.remove("is-dragging"); dragFrom = null; });
    fig.addEventListener("dragover", function (e) { if (dragFrom && dragFrom !== p) { e.preventDefault(); fig.classList.add("is-target"); } });
    fig.addEventListener("dragleave", function () { fig.classList.remove("is-target"); });
    fig.addEventListener("drop", function (e) {
      e.preventDefault(); fig.classList.remove("is-target");
      if (!dragFrom || dragFrom === p) return;
      var rect = fig.getBoundingClientRect();
      var afterTarget = he ? e.clientX < rect.left + rect.width / 2 : e.clientX > rect.left + rect.width / 2;
      var moved = state.list.splice(state.list.indexOf(dragFrom), 1)[0];
      state.list.splice(state.list.indexOf(p) + (afterTarget ? 1 : 0), 0, moved);
      dragFrom = null; changed();
    });
    fig.setAttribute("aria-label", nameOf(p) + (d["cover_alt_" + lang] ? " — " + d["cover_alt_" + lang] : ""));
    return fig;
  }
  var pendingDraw = false;
  function redraw() {
    var a = document.activeElement;
    if (a && a.isContentEditable) {
      if (!pendingDraw) { pendingDraw = true; a.addEventListener("blur", function () { pendingDraw = false; render(); }, { once: true }); }
      return;
    }
    render();
  }

  // ---------- selection frame (click a picture, drag a dot to resize) ----------
  function deselectAll() { Array.prototype.forEach.call(document.querySelectorAll(".pe-selected"), function (n) { n.classList.remove("pe-selected"); }); }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".pe-framed, .pe-modal")) { deselectAll(); selected = null; } });
  function frame(box, o) {
    box.classList.add("pe-framed");
    if (o.selectedNow) box.classList.add("pe-selected");
    box.setAttribute("title", T.frameTip);
    box.addEventListener("click", function (e) {
      if (e.target.closest(".pe-tools, .pe-dot")) return;
      e.preventDefault();
      var was = box.classList.contains("pe-selected");
      deselectAll();
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
        box.setAttribute("draggable", "false");
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
          pct = Math.max(10, Math.min(100, Math.round(startPct + dd / areaW * 100)));
          label.textContent = T.widthLabel + " " + pct + "%";
          o.live(pct);
        }
        function up() {
          dot.removeEventListener("pointermove", mv); dot.removeEventListener("pointerup", up); dot.removeEventListener("pointercancel", up);
          box.classList.remove("is-resizing"); box.setAttribute("draggable", "true");
          if (pct !== Math.round(startPct)) o.done(pct);
          setTimeout(function () { label.textContent = ""; }, 900);
        }
        dot.addEventListener("pointermove", mv); dot.addEventListener("pointerup", up); dot.addEventListener("pointercancel", up);
      });
      box.appendChild(dot);
    });
  }

  // ---------- description for blind visitors ----------
  function describe(curHe, curEn, done) { core.describe(T, curHe, curEn, done); }

  // ---------- picture chooser ----------
  var imageList = null;
  function listImages() {
    if (imageList) return Promise.resolve(imageList);
    var get = function (dd) { return api("/contents/" + encPath(dd) + ref).catch(function () { return []; }); };
    return Promise.all([get("assets/work"), get("assets/uploads")]).then(function (top) {
      var sub = (Array.isArray(top[1]) ? top[1] : []).filter(function (f) { return f.type === "dir"; }).map(function (f) { return get(f.path); });
      return Promise.all(sub).then(function (more) { return top.concat(more); });
    }).then(function (res) {
      var out = [];
      res.forEach(function (items) {
        (Array.isArray(items) ? items : []).forEach(function (f) {
          if (f.type === "file" && /\.(jpe?g|png|webp|gif)$/i.test(f.name)) out.push(f.path);
        });
      });
      Object.keys(uploads).forEach(function (p) { if (out.indexOf(p) < 0) out.unshift(p); });
      imageList = out;
      return out;
    });
  }
  function pick(slug, done, note) {
    var chosen = "";
    var grid = el("div", { "class": "pe-pick-grid" }, [el("p", { text: T.pickLoading })]);
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input" });
    var chooseBtn = button(T.choose, function () { if (!chosen) return; close(); done(chosen, { he: altHe.value.trim(), en: altEn.value.trim() }); }, "pe-btn pe-primary");
    chooseBtn.disabled = true;
    var file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "class": "pe-file" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var safe = f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "picture";
      var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
      var path = "assets/uploads/" + slug + "/" + safe + "-" + Date.now().toString(36) + ext;
      uploads[path] = { file: f, blobUrl: URL.createObjectURL(f) };
      if (imageList) imageList.unshift(path);
      choosePath(path);
      draw();
    });
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.pickTitle }, [
      el("div", { "class": "pe-modal-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.pickTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("label", { "class": "pe-upload" }, [document.createTextNode(T.pickUpload + " "), file, el("span", { "class": "pe-note", text: " " + T.uploadNote })]),
        grid,
        el("div", { "class": "pe-modal-foot" }, [
          el("p", { "class": "pe-note", text: note || T.altEdit }),
          el("label", {}, [document.createTextNode(T.altHe), altHe]),
          el("label", {}, [document.createTextNode(T.altEn), altEn]),
          chooseBtn,
        ]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    function choosePath(path) {
      chosen = path; chooseBtn.disabled = false;
      Array.prototype.forEach.call(grid.querySelectorAll("button[data-path]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-path") === path)); });
    }
    function draw() {
      grid.textContent = "";
      (imageList || []).forEach(function (p) {
        var b = el("button", { type: "button", "class": "pe-pick", "data-path": p, "aria-pressed": String(p === chosen), title: p.split("/").pop(), "aria-label": p.split("/").pop() }, [picture(p, "160px")]);
        b.addEventListener("click", function () { choosePath(p); });
        b.addEventListener("dblclick", function () { choosePath(p); chooseBtn.click(); });
        grid.appendChild(b);
      });
    }
    document.body.appendChild(dialog);
    listImages().then(draw);
  }

  // ---------- first-time tips ----------
  var TIP = "bubapix-work-editor-tip";
  function showTip(force) {
    var seen = false;
    try { seen = localStorage.getItem(TIP) === "1"; } catch (e) { seen = false; }
    if (seen && !force) return;
    var old = document.querySelector(".pe-tip");
    if (old) old.remove();
    var box = el("div", { "class": "pe-tip", role: "note" }, [
      el("strong", { text: T.tipTitle }),
      el("ol", {}, (touch.matches ? [T.tip1, T.tipTouch, T.tip3, T.tip4] : [T.tip1, T.tip2, T.tip3, T.tip4]).map(function (t) { return el("li", { text: t }); })),
      button(T.tipClose, function () { try { localStorage.setItem(TIP, "1"); } catch (e) { /* storage blocked */ } box.remove(); }, "pe-btn pe-primary"),
    ]);
    bar.parentNode.insertBefore(box, bar.nextSibling);
  }

  // ---------- after saving: is the test site updated yet? ----------
  var watcher = core.siteWatch({ base: BASE, api: api, T: T, status: status, setStatus: setStatus, dirty: dirty });
  function watchSite() { watcher.watch(); }
  function followSave(commitSha) { watcher.follow(commitSha, trNote(), trKind()); }

  // ---------- save ----------

  // ---------- automatic translation on saving (js/auto-translate.js, owner only) ----------
  var trRes = { n: 0 }, translating = false;
  var trReady = new Promise(function (resolve) {
    var src = launcher.getAttribute("data-tr-src");
    if (window.BubaTranslate || !src) { resolve(); return; }
    var s = document.createElement("script");
    s.src = src; s.onload = s.onerror = function () { resolve(); };
    document.head.appendChild(s);
  });
  trReady.then(function () { if (window.BubaTranslate) (bar.querySelector(".pe-bar-layout") || bar).appendChild(window.BubaTranslate.toggle()); });
  var trPairs = function () { return [{ now: state, before: JSON.parse(original) }]; };
  function trNote() { var n = window.BubaTranslate ? window.BubaTranslate.note(trRes) : ""; return n ? " " + n : ""; }
  function trKind() { return trRes.failed ? "warn" : "ok"; }
  function save() {
    if (!dirty() || translating) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    translating = true; saveBtn.disabled = true; trRes = { n: 0 };
    trReady
      .then(function () { return window.BubaTranslate ? window.BubaTranslate.run(trPairs(), { onStart: function (m) { setStatus(m); } }) : { n: 0 }; })
      .then(function (r) { trRes = r; }, function () { trRes = { n: 0, failed: true }; })
      .then(function () { translating = false; saveNow(); });
  }
  function saveNow() {
    lastCommit = "";
    if (!dirty()) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    saveBtn.disabled = true;
    setStatus(T.saving);
    // The order on the page becomes 1, 2, 3… for the projects shown here.
    state.list.forEach(function (p, i) { if (Number(p.data.order) !== i + 1) p.data.order = i + 1; });
    var orig = JSON.parse(original);
    var origBy = {};
    orig.list.forEach(function (p) { origBy[p.slug] = p.data; });
    var writes = [];
    if (JSON.stringify(state.labels) !== JSON.stringify(orig.labels)) writes.push({ file: files.labels, data: state.labels, message: "Projects page: texts edited on the page" });
    state.list.forEach(function (p) {
      if (JSON.stringify(p.data) !== JSON.stringify(origBy[p.slug])) writes.push({ file: files.projects[p.slug], data: p.data, message: "Project " + p.slug + ": changed on the projects page (order, size or picture)" });
    });
    var used = {};
    state.list.forEach(function (p) { var u = uploads[norm(p.data.cover)]; if (u && !u.done) used[norm(p.data.cover)] = true; });
    var wrote = 0;
    // First make sure no file changed elsewhere since it was loaded; only then write.
    Promise.all(writes.map(function (w) {
      return api("/contents/" + encPath(w.file.path) + ref).then(function (cur) { return cur.sha; }).catch(function (err) { if (err.status === 404) return ""; throw err; });
    }))
      .then(function (shas) {
        writes.forEach(function (w, k) { if (shas[k] !== w.file.sha) { var err = new Error("changed"); err.changed = true; throw err; } });
        var chain = Promise.resolve();
        Object.keys(used).forEach(function (path) {
          chain = chain.then(function () { return readB64(uploads[path].file); })
            .then(function (b64) { return api("/contents/" + encPath(path), { method: "PUT", body: { message: "Upload picture (projects page, edited on the page)", content: b64, branch: BRANCH } }); })
            .then(function () { uploads[path].done = true; });
        });
        writes.forEach(function (w) {
          chain = chain.then(function () {
            var body = { message: w.message, content: utf8ToB64(JSON.stringify(w.data, null, 2) + "\n"), branch: BRANCH };
            if (w.file.sha) body.sha = w.file.sha;
            return api("/contents/" + encPath(w.file.path), { method: "PUT", body: body }).then(function (res) { w.file.sha = res.content.sha; wrote++; });
          });
        });
        return chain.then(function () { return window.BubaStyle ? window.BubaStyle.save("projects page") : ""; }).then(function (c) { if (c) { lastCommit = c; wrote++; } });
      })
      .then(function () {
        original = snap();
        saveBtn.disabled = true;
        followSave(lastCommit);
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        if (wrote) { setStatus(T.errPartial, "error"); return; }
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    original = state ? snap() : original;
    leaving = true;
    location.reload();
  }
})();

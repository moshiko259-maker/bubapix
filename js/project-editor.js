/*
 * BubaPix: editing a project page on the page itself (owner only).
 *
 * Loaded only when the owner presses "Edit on the page" on a project page
 * (the edit bar appears only in a browser where the owner switched edit
 * buttons on). Nothing here runs for visitors.
 *
 * What it does: reads the project's file (content/projects/<slug>.json)
 * from the GitHub repository and lets the owner, right on the page:
 *   - write the short sentence and the longer text (in the page's language),
 *   - replace the cover picture,
 *   - reorder, replace, hide, show and remove pictures in the galleries,
 *   - add pictures (from the site or uploaded from this computer),
 *   - write descriptions for blind visitors.
 * It saves the file back to the work branch with the owner's own GitHub
 * sign-in (the one saved in this browser by the admin panel). The live site
 * is not touched: the work branch is published only to the private test site.
 *
 * Everything else in the file (links, titles, frames, hidden sections,
 * videos, the other language) is kept exactly as it is.
 */
(function () {
  "use strict";
  if (window.__bubapixPageEditor) return;
  window.__bubapixPageEditor = true;

  var launcher = document.querySelector("[data-page-editor]");
  var article = document.querySelector("article.project[data-slug]");
  if (!launcher || !article) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var SLUG = article.getAttribute("data-slug");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(SLUG || "")) return;
  var FILE = "content/projects/" + SLUG + ".json";
  var API = "https://api.github.com/repos/" + REPO;
  var lang = document.documentElement.lang === "he" ? "he" : "en";
  var he = lang === "he";

  var T = he ? {
    title: "עריכת דף הפרויקט",
    loading: "טוען את דף הפרויקט…",
    save: "שמירה",
    saving: "שומר…",
    cancel: "יציאה בלי לשמור",
    close: "סגירה",
    saved: "נשמר. אתר הבדיקה יתעדכן (האתר החי לא משתנה).",
    unsaved: "יש שינויים שלא נשמרו",
    noChanges: "אין שינויים",
    undo: "ביטול פעולה",
    undoTip: "ביטול הפעולה האחרונה (Ctrl+Z)",
    nothingToUndo: "אין מה לבטל",
    undone: "הפעולה בוטלה",
    lede: "משפט קצר על הפרויקט (לחצו כדי לכתוב)",
    synopsisTitle: "תקציר",
    synopsis: "טקסט על הפרויקט (לחצו כדי לכתוב). שורה ריקה מתחילה פסקה חדשה.",
    langNote: "הטקסטים נשמרים בעברית בלבד. לטקסט באנגלית — פתחו את הדף באנגלית.",
    coverTitle: "תמונת השער",
    coverNote: "תמונת השער מופיעה גם כפוסטר של הפרויקט בדף הבית ובעמוד הפרויקטים.",
    replaceCover: "החלפת תמונת השער",
    addCover: "הוספת תמונת שער",
    gallery: "תמונות",
    behind: "מאחורי הקלעים",
    earlier: "הזזה אחורה", later: "הזזה קדימה", drag: "גררו כדי לשנות את הסדר",
    replace: "החלפה", hide: "הסתרה", show: "הצגה", remove: "הסרה מהגלריה",
    describe: "תיאור לעיוורים",
    noAlt: "אין תיאור לעיוורים",
    add: "הוספת תמונה",
    newGallery: "הוספת גלריה לדף",
    hiddenTitle: "תמונות מוסתרות בגלריה הזו (נשמרות, לא מוצגות)",
    hiddenSections: "בדף יש גם {n} קבוצות תמונות מוסתרות (מכלי הניהול). הן לא מוצגות כאן ולא משתנות.",
    removed: "התמונה הוסרה מהגלריה (הקובץ עצמו נשאר באתר). אפשר לבטל עם ״ביטול פעולה״.",
    pickTitle: "בחירת תמונה",
    pickUpload: "העלאה מהמחשב",
    pickLoading: "טוען תמונות…",
    altHe: "תיאור התמונה לעיוורים, עברית",
    altEn: "תיאור התמונה לעיוורים, אנגלית",
    altNew: "תמונה חדשה צריכה תיאור חדש. כתבו בקצרה מה רואים בתמונה (רשות, אפשר גם אחר כך).",
    altEdit: "כתבו בקצרה מה רואים בתמונה. קוראי מסך מקריאים את זה לגולשים עיוורים.",
    choose: "בחירה",
    ok: "אישור",
    newBadge: "חדשה",
    uploadNote: "תמונה שמעלים כאן נשמרת בתיקיית הפרויקט הזה.",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״כניסה לעריכת תוכן״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את דף הפרויקט מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא השתנה.",
    errChanged: "דף הפרויקט השתנה בינתיים במקום אחר (למשל בכלי הניהול או בעריכה של דף הבית). כדי לא למחוק את השינוי ההוא, לא שמרתי. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    publishing: "נשמר ✓ אתר הבדיקה מתעדכן. אפשר להמשיך לעבוד.",
    published: "האתר עודכן ✓",
    reload: "רענון לראות",
    slow: "העדכון לוקח יותר מהרגיל. השינוי שמור; אפשר לבדוק שוב מאוחר יותר.",
    tipTitle: "איך עורכים את דף הפרויקט",
    tip1: "לוחצים על המשפט הקצר או על הטקסט וכותבים.",
    tip2: "מעבירים עכבר על תמונה (בטלפון: הכלים מתחת לכל תמונה): מופיעים חצים להזזה, החלפה, הסתרה, הסרה ותיאור לעיוורים. אפשר גם לגרור תמונה למקום אחר.",
    tip3: "״הוספת תמונה״ — מהתמונות שבאתר או מהמחשב.",
    tip4: "שום דבר לא נשמר עד ״שמירה״. טעיתם? ״ביטול פעולה״.",
    tipClose: "הבנתי",
    help: "עזרה",
  } : {
    title: "Editing the project page",
    loading: "Loading the project page…",
    save: "Save",
    saving: "Saving…",
    cancel: "Leave without saving",
    close: "Close",
    saved: "Saved. The test site will update (the live site does not change).",
    unsaved: "Unsaved changes",
    noChanges: "No changes",
    undo: "Undo",
    undoTip: "Undo the last action (Ctrl+Z)",
    nothingToUndo: "Nothing to undo",
    undone: "Undone",
    lede: "A short sentence about the project (click to write)",
    synopsisTitle: "Synopsis",
    synopsis: "Text about the project (click to write). An empty line starts a new paragraph.",
    langNote: "Texts are saved in English only. For the Hebrew text, open the page in Hebrew.",
    coverTitle: "Cover picture",
    coverNote: "The cover is also the project's poster on the homepage and on the projects page.",
    replaceCover: "Replace the cover",
    addCover: "Add a cover",
    gallery: "Images",
    behind: "Behind the scenes",
    earlier: "Move earlier", later: "Move later", drag: "Drag to change the order",
    replace: "Replace", hide: "Hide", show: "Show", remove: "Remove from gallery",
    describe: "Description for blind visitors",
    noAlt: "No description for blind visitors",
    add: "Add a picture",
    newGallery: "Add a gallery to the page",
    hiddenTitle: "Hidden pictures in this gallery (kept, not shown)",
    hiddenSections: "The page also has {n} hidden picture groups (from the admin panel). They are not shown here and do not change.",
    removed: "The picture was removed from the gallery (the file itself stays on the site). You can undo it.",
    pickTitle: "Choose a picture",
    pickUpload: "Upload from this computer",
    pickLoading: "Loading pictures…",
    altHe: "Description for blind visitors, Hebrew",
    altEn: "Description for blind visitors, English",
    altNew: "A new picture needs a new description. Say briefly what the picture shows (optional, can be done later).",
    altEdit: "Say briefly what the picture shows. Screen readers read it to blind visitors.",
    choose: "Choose",
    ok: "OK",
    newBadge: "new",
    uploadNote: "A picture uploaded here is stored in this project's folder.",
    signIn: "To edit, sign in once to the admin panel in this browser (\"Manage\" → content editing), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the project page from GitHub.",
    errSave: "Saving failed. Nothing was changed.",
    errChanged: "The project page was changed elsewhere in the meantime (for example in the admin panel or while editing the homepage). To keep that change, nothing was saved. Leave editing, reload the page and try again.",
    errAuth: "The sign-in expired or has no permission. Sign in to the admin panel again and retry.",
    leave: "There are unsaved changes. Leave anyway?",
    publishing: "Saved ✓ The test site is updating. You can keep working.",
    published: "The site is updated ✓",
    reload: "Reload to see it",
    slow: "The update is taking longer than usual. The change is saved; check again later.",
    tipTitle: "How to edit the project page",
    tip1: "Click the short sentence or the text and write.",
    tip2: "Point at a picture (on phones: the tools are under each picture): arrows to move it, replace, hide, remove and a description for blind visitors appear. You can also drag a picture to another place.",
    tip3: "\"Add a picture\": from the pictures on the site or from this computer.",
    tip4: "Nothing is saved until \"Save\". Made a mistake? \"Undo\".",
    tipClose: "Got it",
    help: "Help",
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
          if (!res.ok) { var err = new Error("GitHub " + res.status); err.status = res.status; err.data = data; throw err; }
          if (opts.method === "PUT" && data && data.commit && data.commit.sha) lastCommit = data.commit.sha;
          return data;
        });
      });
  }
  var encPath = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
  var ref = "?ref=" + encodeURIComponent(BRANCH);

  // Where the site's files are (the page lives in a sub-folder).
  var styleLink = document.querySelector('link[href*="css/styles.css"]');
  var BASE = styleLink ? styleLink.getAttribute("href").split("css/styles.css")[0] : "";
  var norm = function (p) { return String(p || "").replace(/^\//, ""); };
  var url = function (p) { return BASE + norm(p); };

  // Pictures already on the page: reuse their small sizes and proportions.
  var known = {};
  Array.prototype.forEach.call(document.querySelectorAll("img"), function (img) {
    var src = img.getAttribute("src") || "";
    if (BASE && src.indexOf(BASE) === 0) src = src.slice(BASE.length);
    known[norm(src)] = { srcset: img.getAttribute("srcset") || "", w: Number(img.getAttribute("width")) || 0, h: Number(img.getAttribute("height")) || 0 };
  });
  var FRAMES = { wide: 2.4, landscape: 1.78, square: 1, portrait: 0.8 };
  var natural = {}; // proportions measured after loading, for pictures new to the page
  function ratioOf(g) {
    if (FRAMES[g.frame]) return FRAMES[g.frame];
    var k = known[norm(g.image)], r = k && k.w && k.h ? k.w / k.h : natural[norm(g.image)] || 1.5;
    return Math.min(4, Math.max(0.4, Math.round(r * 100) / 100));
  }
  var uploads = {}; // path -> { file, blobUrl } waiting for "Save"
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
  var data = null, sha = "", original = "";
  var dirty = function () { return !!data && JSON.stringify(data) !== original; };

  // ---------- toolbar ----------
  var status = el("span", { "class": "pe-status", role: "status", "aria-live": "polite" });
  var saveBtn = button(T.save, save, "pe-btn pe-primary");
  var undoBtn = button("↶ " + T.undo, undo, "pe-btn", T.undoTip);
  undoBtn.disabled = true;
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }, [button("? " + T.help, function () { showTip(true); }, "pe-btn pe-ghost")]),
    status,
    el("span", { "class": "pe-bar-actions" }, [undoBtn, saveBtn, button(T.cancel, quit, "pe-btn pe-ghost")]),
  ]);
  document.body.insertBefore(bar, document.body.firstChild);
  document.documentElement.classList.add("page-editing");
  setStatus(T.loading);
  saveBtn.disabled = true;

  function setStatus(text, kind) {
    status.textContent = text || "";
    status.className = "pe-status" + (kind ? " is-" + kind : "");
  }
  function refreshStatus() {
    setStatus(dirty() ? T.unsaved : T.noChanges, dirty() ? "warn" : "");
    saveBtn.disabled = !dirty();
  }

  // ---------- undo ----------
  var past = [], last = "";
  function commit() {
    if (!data) return;
    var now = JSON.stringify(data);
    if (last && now !== last) { past.push(last); if (past.length > 100) past.shift(); }
    last = now;
    undoBtn.disabled = !past.length;
  }
  function undo() {
    if (!past.length) { setStatus(T.nothingToUndo); return; }
    data = JSON.parse(past.pop());
    last = JSON.stringify(data);
    undoBtn.disabled = !past.length;
    fillLede(); render(); refreshStatus();
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

  api("/contents/" + encPath(FILE) + ref)
    .then(function (res) {
      sha = res.sha;
      data = JSON.parse(b64ToUtf8(res.content));
      if (!Array.isArray(data.sections)) data.sections = [];
      original = JSON.stringify(data);
      start();
      last = JSON.stringify(data);
      refreshStatus();
      watchSite();
      showTip(false);
    })
    .catch(function (err) {
      setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error");
    });

  window.addEventListener("beforeunload", function (e) {
    if (dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- page parts ----------
  var area = el("div", { "class": "pe-proj-area" });
  var ledeEl = null;

  // Plain-text editing (no hidden formatting is pasted in).
  function editable(node, placeholder, onText) {
    try { node.contentEditable = "plaintext-only"; } catch (e) { node.contentEditable = "true"; }
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.classList.add("pe-editable");
    node.setAttribute("data-placeholder", placeholder);
    node.setAttribute("role", "textbox");
    node.setAttribute("aria-label", placeholder);
    node.addEventListener("input", function () { onText(node.innerText.replace(/ /g, " ")); refreshStatus(); });
    node.addEventListener("blur", function () { commit(); });
    node.addEventListener("paste", function (e) {
      if (node.contentEditable === "plaintext-only" || !e.clipboardData) return;
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    });
  }
  function clean(text) { return String(text || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }

  function start() {
    var head = article.querySelector(".page-head");
    // The visitor's view of the editable parts is replaced by the editing view.
    Array.prototype.forEach.call(article.querySelectorAll(".project-cover"), function (n) { n.hidden = true; });
    var syn = article.querySelector("#synopsis-title");
    if (syn && syn.closest("section")) syn.closest("section").hidden = true;
    var firstGallery = null;
    Array.prototype.forEach.call(article.querySelectorAll(".project-section"), function (s) {
      if (s.querySelector(".jg-project")) { if (!firstGallery) firstGallery = s; s.hidden = true; }
    });
    ledeEl = head ? head.querySelector(".lede") : null;
    if (!ledeEl && head) { ledeEl = el("p", { "class": "lede" }); head.appendChild(ledeEl); }
    if (ledeEl) {
      editable(ledeEl, T.lede, function (txt) { data["text_" + lang] = clean(txt).replace(/\n+/g, " "); });
      fillLede();
    }
    if (head) head.parentNode.insertBefore(area, head.nextSibling);
    else article.insertBefore(area, article.firstChild);
    render();
  }
  function fillLede() { if (ledeEl) ledeEl.textContent = data["text_" + lang] || ""; }

  // ---------- drawing the editing view ----------
  var dragFrom = null; // { s: section index, g: the picture being dragged }
  // A picture new to the page reports its shape after loading; the view is
  // redrawn then, but never while the owner is typing in it.
  var pendingDraw = false;
  function redraw() {
    var a = document.activeElement;
    if (a && a.isContentEditable && area.contains(a)) {
      if (!pendingDraw) { pendingDraw = true; a.addEventListener("blur", function () { pendingDraw = false; render(); }, { once: true }); }
      return;
    }
    render();
  }
  function render() {
    area.textContent = "";
    area.appendChild(coverBlock());
    area.appendChild(synopsisBlock());
    var shown = 0, hiddenGroups = 0;
    data.sections.forEach(function (sec, s) {
      if (!sec || (sec.type !== "gallery" && sec.type !== "behind")) return;
      if (sec.hidden === true) { hiddenGroups++; return; }
      if (!Array.isArray(sec.images)) sec.images = [];
      area.appendChild(galleryBlock(sec, s));
      shown++;
    });
    if (!shown) {
      area.appendChild(el("div", { "class": "pe-add" }, [button("+ " + T.newGallery, function () {
        data.sections.push({ type: "gallery", hidden: false, heading_en: "", heading_he: "", images: [] });
        changed();
      })]));
    }
    if (hiddenGroups) area.appendChild(el("p", { "class": "pe-note pe-proj-note", text: T.hiddenSections.replace("{n}", hiddenGroups) }));
  }

  function coverBlock() {
    var box = el("section", { "class": "project-section pe-cover-sec" }, [el("h2", { "class": "section-label", text: T.coverTitle })]);
    var tools = el("div", { "class": "pe-tools pe-cover-tools" }, [
      button(data.cover ? T.replaceCover : T.addCover, function () {
        pick(function (path, alts) {
          data.cover = "/" + path; data.cover_alt_he = alts.he; data.cover_alt_en = alts.en;
          changed();
        }, T.altNew);
      }, "pe-btn"),
      data.cover ? button(T.describe, function () {
        describe(data.cover_alt_he, data.cover_alt_en, function (alts) { data.cover_alt_he = alts.he; data.cover_alt_en = alts.en; changed(); });
      }, "pe-btn") : null,
    ]);
    if (data.cover) {
      var r = ratioOf({ image: data.cover });
      var coverImg = picture(data.cover, "(max-width: 1440px) 100vw, 1440px", redraw);
      coverImg.setAttribute("loading", "eager");
      var media = el("span", { "class": "jg-media" }, [coverImg]);
      media.style.aspectRatio = String(r);
      var fig = el("figure", { "class": "pe-cover pe-item" }, [media, tools]);
      if (uploads[norm(data.cover)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
      if (!data["cover_alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
      box.appendChild(fig);
    } else {
      box.appendChild(tools);
    }
    box.appendChild(el("p", { "class": "pe-note", text: T.coverNote }));
    return box;
  }

  function synopsisBlock() {
    var sec = el("section", { "class": "project-section" }, [el("h2", { "class": "section-label", text: T.synopsisTitle })]);
    var body = el("div", { "class": "prose prose-large pe-synopsis" });
    body.textContent = data["description_" + lang] || "";
    editable(body, T.synopsis, function (txt) { data["description_" + lang] = clean(txt); });
    sec.appendChild(body);
    sec.appendChild(el("p", { "class": "pe-note", text: T.langNote }));
    return sec;
  }

  function galleryBlock(sec, s) {
    var heading = sec["heading_" + lang] || (sec.type === "behind" ? T.behind : T.gallery);
    var box = el("section", { "class": "project-section pe-gal-sec" }, [el("h2", { "class": "section-label", text: heading })]);
    var grid = el("div", { "class": "jg jg-project pe-gal" });
    var hiddenIdx = [];
    sec.images.forEach(function (g, i) {
      if (!g || !g.image) return;
      if (g.visible === false) { hiddenIdx.push(i); return; }
      grid.appendChild(cell(sec, s, g, i));
    });
    box.appendChild(grid);
    box.appendChild(el("div", { "class": "pe-add" }, [button("+ " + T.add, function () {
      pick(function (path, alts) {
        sec.images.push({ image: "/" + path, link: "", alt_en: alts.en, alt_he: alts.he, title_en: "", title_he: "", note_en: "", note_he: "", caption: "hidden", on_home: false, frame: "natural", focus: "center" });
        changed();
      }, T.altNew);
    })]));
    if (hiddenIdx.length) {
      var row = el("div", { "class": "pe-strip-row" });
      hiddenIdx.forEach(function (i) {
        var g = sec.images[i];
        row.appendChild(el("figure", { "class": "pe-thumb" }, [picture(g.image, "160px"), el("div", { "class": "pe-tools" }, [
          button(T.show, function () { delete g.visible; changed(); }),
          button(T.remove, function () { removeAt(sec, g); }, "pe-btn pe-danger"),
        ])]));
      });
      box.appendChild(el("div", { "class": "pe-strip" }, [el("p", { "class": "pe-strip-title", text: T.hiddenTitle }), row]));
    }
    return box;
  }

  function removeAt(sec, g) {
    var at = sec.images.indexOf(g);
    if (at < 0) return;
    sec.images.splice(at, 1);
    changed();
    setStatus(T.removed, "warn");
  }

  function cell(sec, s, g, i) {
    var r = ratioOf(g);
    var media = el("span", { "class": "jg-media" }, [picture(g.image, "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 40vw", redraw)]);
    media.style.aspectRatio = String(r);
    var fig = el("figure", { "class": "jg-item pe-item" + (FRAMES[g.frame] ? " fit-cover focus-" + (g.focus || "center") : ""), draggable: "true", title: T.drag }, [media]);
    fig.style.flexGrow = String(Math.round(r * 100));
    fig.style.flexBasis = "calc(var(--row-h) * " + r + ")";
    if (uploads[norm(g.image)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
    if (!g["alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
    // Arrow shapes follow the reading direction: "earlier" points right in Hebrew.
    var back = he ? "›" : "‹", fwd = he ? "‹" : "›";
    fig.appendChild(el("div", { "class": "pe-tools" }, [
      button(back, function () { move(sec, g, -1); }, "pe-icon", T.earlier),
      button(fwd, function () { move(sec, g, 1); }, "pe-icon", T.later),
      button(T.replace, function () {
        pick(function (path, alts) { g.image = "/" + path; g.alt_he = alts.he; g.alt_en = alts.en; changed(); }, T.altNew);
      }),
      button(T.describe, function () {
        describe(g.alt_he, g.alt_en, function (alts) { g.alt_he = alts.he; g.alt_en = alts.en; changed(); });
      }),
      button(T.hide, function () { g.visible = false; changed(); }),
      button(T.remove, function () { removeAt(sec, g); }, "pe-btn pe-danger"),
    ]));
    fig.addEventListener("dragstart", function (e) {
      if (e.target && e.target.closest && e.target.closest(".pe-tools")) { e.preventDefault(); return; }
      dragFrom = { s: s, g: g }; fig.classList.add("is-dragging");
      try { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ }
    });
    fig.addEventListener("dragend", function () { fig.classList.remove("is-dragging"); dragFrom = null; });
    fig.addEventListener("dragover", function (e) { if (dragFrom && dragFrom.s === s && dragFrom.g !== g) { e.preventDefault(); fig.classList.add("is-target"); } });
    fig.addEventListener("dragleave", function () { fig.classList.remove("is-target"); });
    fig.addEventListener("drop", function (e) {
      e.preventDefault(); fig.classList.remove("is-target");
      if (!dragFrom || dragFrom.s !== s || dragFrom.g === g) return;
      var rect = fig.getBoundingClientRect();
      var afterTarget = he ? e.clientX < rect.left + rect.width / 2 : e.clientX > rect.left + rect.width / 2;
      var moved = sec.images.splice(sec.images.indexOf(dragFrom.g), 1)[0];
      sec.images.splice(sec.images.indexOf(g) + (afterTarget ? 1 : 0), 0, moved);
      dragFrom = null; changed();
    });
    fig.setAttribute("aria-label", g["alt_" + lang] || g.image);
    return fig;
  }
  // Moves a picture one place among the pictures shown (hidden ones keep their places).
  function move(sec, g, dir) {
    var shownIdx = [];
    sec.images.forEach(function (x, k) { if (x && x.image && x.visible !== false) shownIdx.push(k); });
    var at = shownIdx.indexOf(sec.images.indexOf(g)), other = shownIdx[at + dir];
    if (at < 0 || other === undefined) return;
    var a = shownIdx[at], tmp = sec.images[a];
    sec.images[a] = sec.images[other];
    sec.images[other] = tmp;
    changed();
  }

  // ---------- description for blind visitors ----------
  function describe(curHe, curEn, done) {
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input", value: curHe || "" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input", value: curEn || "" });
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.describe }, [
      el("div", { "class": "pe-modal-box pe-small-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.describe }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("div", { "class": "pe-modal-foot" }, [
          el("p", { "class": "pe-note", text: T.altEdit }),
          el("label", {}, [document.createTextNode(T.altHe), altHe]),
          el("label", {}, [document.createTextNode(T.altEn), altEn]),
          button(T.ok, function () { close(); done({ he: altHe.value.trim(), en: altEn.value.trim() }); }, "pe-btn pe-primary"),
        ]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dialog);
    (he ? altHe : altEn).focus();
  }

  // ---------- picture chooser ----------
  var imageList = null;
  function listImages() {
    if (imageList) return Promise.resolve(imageList);
    var get = function (d) { return api("/contents/" + encPath(d) + ref).catch(function () { return []; }); };
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
      // This project's own pictures first.
      var mine = function (p) { return p.indexOf("assets/uploads/" + SLUG + "/") === 0 ? 0 : 1; };
      out.sort(function (a, b) { return mine(a) - mine(b); });
      Object.keys(uploads).forEach(function (p) { if (out.indexOf(p) < 0) out.unshift(p); });
      imageList = out;
      return out;
    });
  }
  function pick(done, note) {
    var chosen = "";
    var grid = el("div", { "class": "pe-pick-grid" }, [el("p", { text: T.pickLoading })]);
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input" });
    var chooseBtn = button(T.choose, function () {
      if (!chosen) return;
      close();
      done(chosen, { he: altHe.value.trim(), en: altEn.value.trim() });
    }, "pe-btn pe-primary");
    chooseBtn.disabled = true;
    var file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "class": "pe-file" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var safe = f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "picture";
      var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
      // Stored in this project's folder.
      var path = "assets/uploads/" + SLUG + "/" + safe + "-" + Date.now().toString(36) + ext;
      uploads[path] = { file: f, blobUrl: URL.createObjectURL(f) };
      if (imageList) imageList.unshift(path);
      choose(path);
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
    function choose(path) {
      chosen = path; chooseBtn.disabled = false;
      Array.prototype.forEach.call(grid.querySelectorAll("button[data-path]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-path") === path)); });
    }
    function draw() {
      grid.textContent = "";
      (imageList || []).forEach(function (p) {
        var b = el("button", { type: "button", "class": "pe-pick", "data-path": p, "aria-pressed": String(p === chosen), title: p.split("/").pop(), "aria-label": p.split("/").pop() }, [picture(p, "160px")]);
        b.addEventListener("click", function () { choose(p); });
        b.addEventListener("dblclick", function () { choose(p); chooseBtn.click(); });
        grid.appendChild(b);
      });
    }
    document.body.appendChild(dialog);
    listImages().then(draw);
  }

  // ---------- first-time tips ----------
  var TIP = "bubapix-project-editor-tip";
  function showTip(force) {
    var seen = false;
    try { seen = localStorage.getItem(TIP) === "1"; } catch (e) { seen = false; }
    if (seen && !force) return;
    var old = document.querySelector(".pe-tip");
    if (old) old.remove();
    var box = el("div", { "class": "pe-tip", role: "note" }, [
      el("strong", { text: T.tipTitle }),
      el("ol", {}, [T.tip1, T.tip2, T.tip3, T.tip4].map(function (t) { return el("li", { text: t }); })),
      button(T.tipClose, function () { try { localStorage.setItem(TIP, "1"); } catch (e) { /* storage blocked */ } box.remove(); }, "pe-btn pe-primary"),
    ]);
    bar.parentNode.insertBefore(box, bar.nextSibling);
  }

  // ---------- after saving: is the test site updated yet? ----------
  var siteWatch = { available: false, savedCommit: "", timer: 0, started: 0 };
  function readVersion() {
    return fetch(BASE + "version.txt?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { return /^[0-9a-f]{40}$/.test(t.trim()) ? t.trim() : ""; }).catch(function () { return ""; });
  }
  function watchSite() { readVersion().then(function (v) { siteWatch.available = !!v; }); }
  function followSave(commitSha) {
    if (!siteWatch.available || !commitSha) { setStatus(T.saved, "ok"); return; }
    siteWatch.savedCommit = commitSha; siteWatch.started = Date.now();
    setStatus(T.publishing, "ok");
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
          status.appendChild(button(T.reload, function () { location.reload(); }, "pe-btn"));
          return;
        }
        if (Date.now() - siteWatch.started > 15 * 60 * 1000) { setStatus(T.slow, "warn"); return; }
        siteWatch.timer = setTimeout(check, 20000);
      });
    };
    siteWatch.timer = setTimeout(check, 20000);
  }

  // ---------- save ----------
  function readB64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }
  function save() {
    lastCommit = "";
    if (!dirty()) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    saveBtn.disabled = true;
    setStatus(T.saving);
    // Only pictures uploaded now and still used on the page are sent.
    var used = {};
    var all = [data.cover];
    data.sections.forEach(function (sec) { (sec && Array.isArray(sec.images) ? sec.images : []).forEach(function (g) { if (g) all.push(g.image); }); });
    all.forEach(function (p) { var u = uploads[norm(p)]; if (u && !u.done) used[norm(p)] = true; });
    var chain = Promise.resolve();
    Object.keys(used).forEach(function (p) {
      chain = chain.then(function () { return readB64(uploads[p].file); })
        .then(function (b64) { return api("/contents/" + encPath(p), { method: "PUT", body: { message: "Upload picture (project " + SLUG + ", edited on the page)", content: b64, branch: BRANCH } }); })
        .then(function () { uploads[p].done = true; });
    });
    chain
      .then(function () { return api("/contents/" + encPath(FILE) + ref); })
      .then(function (cur) {
        if (cur.sha !== sha) { var err = new Error("changed"); err.changed = true; throw err; }
        return api("/contents/" + encPath(FILE), { method: "PUT", body: { message: "Project " + SLUG + ": edited on the page", content: utf8ToB64(JSON.stringify(data, null, 2) + "\n"), sha: sha, branch: BRANCH } });
      })
      .then(function (res) {
        sha = res.content.sha;
        original = JSON.stringify(data);
        saveBtn.disabled = true;
        followSave(lastCommit);
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    original = data ? JSON.stringify(data) : original; // allow leaving without the browser's own warning
    location.reload();
  }
})();

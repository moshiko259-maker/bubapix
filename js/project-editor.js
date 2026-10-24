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
 *   - write descriptions for blind visitors,
 *   - add videos by their YouTube or Vimeo link (title, wide or upright
 *     frame, order, delete), and move a videos area above or below pictures.
 * It saves the file back to the work branch with the owner's own GitHub
 * sign-in (the one saved in this browser by the admin panel). The live site
 * is not touched: the work branch is published only to the private test site.
 *
 * Everything else in the file (links, titles, frames, hidden sections,
 * video files, the other language) is kept exactly as it is.
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
    titleHint: "שם הפרויקט (לחצו כדי לשנות)",
    titleShared: "לפרויקט אין שם נפרד בעברית, ולכן השם הזה מופיע גם בדף באנגלית.",
    titleEmpty: "שם הפרויקט לא יכול להיות ריק. השם הקודם הוחזר.",
    sizeAll: "גודל כל התמונות במחשב",
    sizeAuto: "אוטומטי",
    perRow: "בשורה",
    freeNote: "גודל חופשי: לוחצים על תמונה, ואז גוררים את הנקודות הכחולות שבמסגרת.",
    phoneNote: "בטלפון התמונות מוצגות אחת מתחת לשנייה. שינוי גודל — במחשב.",
    frameTip: "לחצו על התמונה כדי לבחור אותה, גררו את הנקודות כדי לשנות גודל, או גררו את התמונה כדי להזיז",
    widthLabel: "רוחב",
    coverSize: "גודל: לוחצים על התמונה וגוררים נקודה כחולה (במחשב).",
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
    earlier: "הזזה למקום הקודם", later: "הזזה למקום הבא", prevBtn: "→ קודם", nextBtn: "הבא ←", more: "⋯ עוד", drag: "גררו כדי לשנות את הסדר",
    replace: "החלפה", hide: "הסתרה", show: "הצגה", remove: "הסרה מהגלריה",
    describe: "תיאור לעיוורים",
    noAlt: "אין תיאור לעיוורים",
    add: "הוספת תמונה",
    newGallery: "הוספת גלריה לדף",
    hiddenTitle: "תמונות מוסתרות בגלריה הזאת (נשמרות, לא מוצגות)",
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
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״פתיחת העריכה המתקדמת״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את דף הפרויקט מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא השתנה.",
    errChanged: "דף הפרויקט השתנה בינתיים במקום אחר (למשל בכלי הניהול או בעריכה של דף הבית). כדי לא למחוק את השינוי ההוא, לא שמרתי. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    publishing: "נשמר ✓ אתר הבדיקה מתעדכן. אפשר להמשיך לעבוד.",
    published: "האתר עודכן ✓",
    reload: "רעננו כדי לראות",
    slow: "העדכון לוקח יותר מהרגיל. השינוי שמור; אפשר לבדוק שוב מאוחר יותר.",
    tipTitle: "איך עורכים את דף הפרויקט",
    tip1: "לוחצים על שם הפרויקט, על המשפט הקצר או על הטקסט וכותבים.",
    tip2: "גודל: לוחצים על תמונה ומופיעה מסגרת עם נקודות. גוררים נקודה — התמונה גדלה או קטנה, והשורה מסתדרת לבד. לכל התמונות יחד: ״גודל כל התמונות במחשב״ מעל הגלריה. הזזה: גוררים את התמונה עצמה, או חצים. הכלים (החלפה, הסתרה, הסרה, תיאור לעיוורים) מופיעים כשמעבירים עכבר על תמונה.",
    tip3: "״הוספת תמונה״ — מהתמונות שבאתר או מהמחשב.",
    tip4: "שום דבר לא נשמר עד ״שמירה״. טעיתם? ״ביטול פעולה״.",
    tipTouch: "בטלפון ובטאבלט: נוגעים בתמונה בגלריה כדי לבחור אותה, והכלים (״→ קודם״, ״הבא ←״, החלפה, הסתרה, הסרה, תיאור) מופיעים מתחתיה. נגיעה בתמונה לא משנה כלום בעצמה.",
    tipClose: "הבנתי",
    help: "עזרה",
    tipVideo: "״הוספת סרטון״ — מדביקים קישור מיוטיוב (כפתור ״שיתוף״ ← ״העתקה״). הסרטון נשאר ביוטיוב, ובאתר נשמר רק הקישור.",
    videos: "וידאו", addVideo: "הוספת סרטון", addVideos: "הוספת סרטון לדף",
    videoTitle: "כותרת לסרטון (לא חובה)", videoUrl: "קישור לסרטון ביוטיוב או ב־Vimeo",
    videoUrlHint: "ביוטיוב: ״שיתוף״ ← ״העתקה״, ומדביקים כאן. גם סרטון ״לא רשום״ (Unlisted) מוצג באתר.",
    badVideo: "זה לא קישור של יוטיוב או של Vimeo. בדקו את הקישור ונסו שוב.", changeLink: "שינוי הקישור",
    wide: "רחב (16:9)", tall: "אנכי (טלפון)", shape: "צורת המסגרת", videoFile: "קובץ וידאו שהועלה בכלי הניהול:",
    sectionUp: "↑ האזור למעלה", sectionDown: "↓ האזור למטה", sectionUpTip: "הזזת אזור הסרטונים מעל האזור שלפניו", sectionDownTip: "הזזת אזור הסרטונים מתחת לאזור שאחריו",
    videosNote: "הסרטון עצמו נשאר ביוטיוב; באתר נשמר רק הקישור. אזור בלי סרטונים לא מוצג באתר.",
    videoRemoved: "הסרטון הוסר מהדף (ביוטיוב הוא לא נמחק). אפשר לבטל עם ״ביטול פעולה״.",
    galHeading: "כותרת לגלריה, למשל ״דמויות״ (ריק = ״תמונות״)", galHeadingBehind: "כותרת לאזור (ריק = ״מאחורי הקלעים״)",
    newArea: "אזור סרטונים חדש", newAreaTip: "אזור נוסף עם כותרת משלו, למשל ״טריילר״, ״הסרט המלא״ או ״מאחורי הקלעים״",
    removeArea: "מחיקת האזור", areaRemoved: "אזור הסרטונים הוסר מהדף (ביוטיוב שום דבר לא נמחק). אפשר לבטל עם ״ביטול פעולה״.",
    videoHeading2: "כותרת לאזור, למשל ״טריילר״ או ״הסרט המלא״ (ריק = ״וידאו״)",
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
    titleHint: "Project name (click to change)",
    titleShared: "The project has no separate English name, so this name also shows on the English page.",
    titleEmpty: "The project name cannot be empty. The previous name is back.",
    sizeAll: "Size of all pictures on computers",
    sizeAuto: "Automatic",
    perRow: "per row",
    freeNote: "Free size: click a picture, then drag the blue dots on its frame.",
    phoneNote: "On phones the pictures show one under another. Resize on a computer.",
    frameTip: "Click the picture to select it, drag the dots to resize, or drag the picture to move it",
    widthLabel: "Width",
    coverSize: "Size: click the picture and drag a blue dot (on computers).",
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
    earlier: "Move to the previous place", later: "Move to the next place", prevBtn: "← Earlier", nextBtn: "Later →", more: "⋯ More", drag: "Drag to change the order",
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
    signIn: "To edit, sign in once to the admin panel in this browser (\"All management\" → \"Open advanced editing\"), then come back here.",
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
    tip1: "Click the project name, the short sentence or the text and write.",
    tip2: "Size: click a picture and a frame with dots appears. Drag a dot: the picture grows or shrinks and its row rearranges itself. For all pictures at once: \"Size of all pictures on computers\" above the gallery. Move: drag the picture itself, or use the arrows. Tools (replace, hide, remove, description) appear when you point at a picture.",
    tip3: "\"Add a picture\": from the pictures on the site or from this computer.",
    tip4: "Nothing is saved until \"Save\". Made a mistake? \"Undo\".",
    tipTouch: "On phones and tablets: tap a gallery picture to choose it, and its tools (\"← Earlier\", \"Later →\", replace, hide, remove, description) appear below it. A tap on a picture changes nothing by itself.",
    tipClose: "Got it",
    help: "Help",
    tipVideo: "\"Add a video\": paste a YouTube link (\"Share\" → \"Copy\"). The video stays on YouTube; the site keeps only the link.",
    videos: "Video", addVideo: "Add a video", addVideos: "Add a video to the page",
    videoTitle: "Title of the video (optional)", videoUrl: "Link to the video on YouTube or Vimeo",
    videoUrlHint: "On YouTube: \"Share\" → \"Copy\", then paste here. An unlisted video also shows on the site.",
    badVideo: "That is not a YouTube or Vimeo link. Check the link and try again.", changeLink: "Change the link",
    wide: "Wide (16:9)", tall: "Upright (phone)", shape: "Frame shape", videoFile: "A video file uploaded in the admin panel:",
    sectionUp: "↑ Area up", sectionDown: "↓ Area down", sectionUpTip: "Move the videos area above the area before it", sectionDownTip: "Move the videos area below the area after it",
    videosNote: "The video itself stays on YouTube; the site keeps only the link. An area without videos is not shown on the site.",
    videoRemoved: "The video was removed from the page (it is not deleted on YouTube). You can undo it.",
    galHeading: "Heading for this gallery, e.g. \"Characters\" (empty = \"Images\")", galHeadingBehind: "Heading for this area (empty = \"Behind the scenes\")",
    newArea: "New videos area", newAreaTip: "Another area with its own heading, e.g. \"Trailer\", \"Full film\" or \"Behind the scenes\"",
    removeArea: "Delete the area", areaRemoved: "The videos area was removed from the page (nothing is deleted on YouTube). You can undo it.",
    videoHeading2: "Heading for this area, e.g. \"Trailer\" or \"Full film\" (empty = \"Video\")",
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
    // A name for screen readers only when the button shows a sign and no words.
    var a = { type: "button", "class": cls || "pe-btn", text: label, title: title || label, onclick: onClick };
    if (title && !/[A-Za-z\u0590-\u05FF]/.test(label)) a["aria-label"] = title;
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
  // Text styles (js/text-style.js) are saved together with the project.
  var dirty = function () { return !!data && (JSON.stringify(data) !== original || !!(window.BubaStyle && window.BubaStyle.dirty())); };

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
      loadStyles();
    })
    .catch(function (err) {
      setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error");
    });
  function loadStyles() {
    var src = launcher.getAttribute("data-ts-src");
    var go = function () { if (window.BubaStyle) window.BubaStyle.start({ onChange: refreshStatus }).catch(function () { /* styles stay as they are */ }); };
    if (window.BubaStyle || !src) { go(); return; }
    var sc = document.createElement("script");
    sc.src = src; sc.onload = go;
    document.head.appendChild(sc);
  }

  var leaving = false;
  window.addEventListener("beforeunload", function (e) {
    if (!leaving && dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- page parts ----------
  var area = el("div", { "class": "pe-proj-area" });
  var ledeEl = null, titleEl = null, titleField = "title_" + lang;

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
      else if (s.classList.contains("videos")) s.hidden = true;
    });
    // The project name: the field the page shows (a name without a Hebrew
    // version is shared by both languages, as on the site).
    var h1 = article.querySelector("[data-project-title]");
    if (h1) {
      h1.classList.remove("visually-hidden");
      h1.classList.add("page-title");
      var shared = !data["title_" + lang];
      titleField = shared ? (lang === "he" ? "title_en" : "title_he") : "title_" + lang;
      if (!data[titleField]) titleField = "title_" + lang;
      h1.textContent = data[titleField] || h1.textContent;
      editable(h1, T.titleHint, function (txt) { data[titleField] = clean(txt).replace(/\n+/g, " "); });
      h1.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); h1.blur(); } });
      h1.addEventListener("blur", function () {
        if (!clean(data[titleField])) { data[titleField] = JSON.parse(original)[titleField]; h1.textContent = data[titleField]; setStatus(T.titleEmpty, "warn"); }
      });
      titleEl = h1;
      if (titleField !== "title_" + lang) head.insertBefore(el("p", { "class": "pe-note pe-title-note", text: T.titleShared }), h1.nextSibling);
    }
    ledeEl = head ? head.querySelector(".lede") : null;
    if (!ledeEl && head) { ledeEl = el("p", { "class": "lede", "data-ts": "project/lede" }); head.appendChild(ledeEl); }
    if (ledeEl) {
      editable(ledeEl, T.lede, function (txt) { data["text_" + lang] = clean(txt).replace(/\n+/g, " "); });
      fillLede();
    }
    if (head) head.parentNode.insertBefore(area, head.nextSibling);
    else article.insertBefore(area, article.firstChild);
    render();
  }
  function fillLede() {
    if (ledeEl) ledeEl.textContent = data["text_" + lang] || "";
    if (titleEl) titleEl.textContent = data[titleField] || "";
  }

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
    // A page without videos: "Add a video to the page" sits where the new videos area will go (above the pictures).
    var videoSlot = el("div", { "class": "pe-add pe-video-slot" });
    area.appendChild(videoSlot);
    var shown = 0, hiddenGroups = 0, videoAreas = 0;
    data.sections.forEach(function (sec, s) {
      if (!sec || (sec.type !== "gallery" && sec.type !== "behind" && sec.type !== "videos")) return;
      if (sec.hidden === true) { if (sec.type !== "videos") hiddenGroups++; return; }
      if (sec.type === "videos") {
        if (!Array.isArray(sec.items)) sec.items = [];
        area.appendChild(videosBlock(sec, s));
        videoAreas++;
        return;
      }
      if (!Array.isArray(sec.images)) sec.images = [];
      area.appendChild(galleryBlock(sec, s));
      shown++;
    });
    var adds = [];
    if (!shown) {
      adds.push(button("+ " + T.newGallery, function () {
        data.sections.push({ type: "gallery", hidden: false, heading_en: "", heading_he: "", images: [] });
        changed();
      }));
    }
    if (videoAreas) videoSlot.remove();
    else {
      videoSlot.appendChild(button("+ " + T.addVideos, function () {
        askVideo(null, function (item) {
          var first = -1;
          data.sections.forEach(function (sec, i) { if (first < 0 && sec && sec.hidden !== true && (sec.type === "gallery" || sec.type === "behind")) first = i; });
          var sec = { type: "videos", hidden: false, heading_en: "", heading_he: "", items: [item] };
          if (first < 0) data.sections.push(sec); else data.sections.splice(first, 0, sec);
          changed();
        });
      }, "pe-btn pe-add-video"));
    }
    if (adds.length) area.appendChild(el("div", { "class": "pe-add" }, adds));
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
      // Cover size (computers): drag a dot; the width is kept in cover_w.
      var cw = Number(data.cover_w) >= 20 && Number(data.cover_w) < 100 ? Number(data.cover_w) : 0;
      if (cw && !narrow.matches) { fig.style.maxWidth = cw + "%"; fig.style.marginInline = "auto"; }
      if (!narrow.matches) frame(fig, {
        min: 20,
        start: function () { return fig.getBoundingClientRect().width / (box.getBoundingClientRect().width || 1) * 100; },
        area: function () { return box.getBoundingClientRect().width; },
        live: function (pct) { fig.style.maxWidth = pct + "%"; fig.style.marginInline = "auto"; },
        done: function (pct) { if (pct >= 100) delete data.cover_w; else data.cover_w = pct; selectedCover = true; changed(); },
        selectedNow: selectedCover,
      });
      if (uploads[norm(data.cover)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
      if (!data["cover_alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
      box.appendChild(fig);
    } else {
      box.appendChild(tools);
    }
    box.appendChild(el("p", { "class": "pe-note", text: T.coverNote + (narrow.matches ? "" : " " + T.coverSize) }));
    return box;
  }

  function synopsisBlock() {
    var sec = el("section", { "class": "project-section" }, [el("h2", { "class": "section-label", text: T.synopsisTitle, "data-ts": "project/section-title" })]);
    var body = el("div", { "class": "prose prose-large pe-synopsis", "data-ts": "project/synopsis" });
    body.textContent = data["description_" + lang] || "";
    editable(body, T.synopsis, function (txt) { data["description_" + lang] = clean(txt); });
    sec.appendChild(body);
    sec.appendChild(el("p", { "class": "pe-note", text: T.langNote }));
    return sec;
  }

  function galleryBlock(sec, s) {
    // The heading: written here (empty = the usual "Images" / "Behind the scenes").
    var head = el("h2", { "class": "section-label pe-gal-head", "data-ts": "project/section-title" });
    head.textContent = sec["heading_" + lang] || "";
    editable(head, (sec.type === "behind" ? T.galHeadingBehind : T.galHeading), function (txt) { sec["heading_" + lang] = clean(txt).replace(/\n+/g, " "); });
    head.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); head.blur(); } });
    var box = el("section", { "class": "project-section pe-gal-sec" }, [head]);
    var hiddenIdx = [], shownList = [];
    sec.images.forEach(function (g, i) {
      if (!g || !g.image) return;
      if (g.visible === false) { hiddenIdx.push(i); return; }
      shownList.push({ g: g, i: i, r: ratioOf(g) });
    });
    // Size of all pictures at once: a number per row sets the same width
    // for every picture; "automatic" goes back to the usual layout.
    var free = isFree(sec) && !narrow.matches;
    var per = sameWidth(shownList);
    box.appendChild(el("div", { "class": "pe-gal-tools" }, [
      el("label", { "class": "pe-gal-size" }, [
        document.createTextNode(T.sizeAll + " "),
        selectBox(T.sizeAll, per, [["auto", T.sizeAuto], ["1", "1 " + T.perRow], ["2", "2 " + T.perRow], ["3", "3 " + T.perRow], ["4", "4 " + T.perRow]].concat(per === "free" ? [["free", T.freeNote.split(":")[0]]] : []), function (v) {
          sec.images.forEach(function (g) { if (!g) return; if (v === "auto") delete g.fw; else if (v !== "free") g.fw = Math.floor(100 / Number(v)); });
          changed();
        }),
      ]),
      el("span", { "class": "pe-note", text: narrow.matches ? T.phoneNote : T.freeNote }),
    ]));
    var grid;
    if (free) {
      grid = el("div", { "class": "jg-project jg-free pe-gal" });
      freeRows(shownList).forEach(function (row) {
        var r = el("div", { "class": "mrow n" + row.length });
        row.forEach(function (it) { r.appendChild(cell(sec, s, it.g, it.i, it, grid)); });
        grid.appendChild(r);
      });
    } else {
      grid = el("div", { "class": "jg jg-project pe-gal" });
      shownList.forEach(function (it) { grid.appendChild(cell(sec, s, it.g, it.i, null, grid)); });
    }
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

  // ---------- videos (a "videos" area: links to YouTube or Vimeo) ----------
  function parseVideo(u) {
    var m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(String(u || "").trim());
    if (m) return { kind: "youtube", id: m[1] };
    m = /^https:\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d{5,12})/.exec(String(u || "").trim());
    if (m) return { kind: "vimeo", id: m[1] };
    return null;
  }
  function isTall(v) { return v.shape === "tall" || (!v.shape && /youtube\.com\/shorts\//.test(v.url || "")); }
  function player(v) {
    var p = parseVideo(v.url);
    if (!p) return el("p", { "class": "pe-note pe-video-file", text: T.videoFile + " " + String(v.file || "").split("/").pop() });
    var src = p.kind === "youtube" ? "https://www.youtube-nocookie.com/embed/" + p.id : "https://player.vimeo.com/video/" + p.id + "?dnt=1";
    return el("div", { "class": "video" + (isTall(v) ? " video-tall" : "") }, [el("iframe", { src: src, title: v["title_" + lang] || T.videos, loading: "lazy", allow: "encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "", referrerpolicy: "strict-origin-when-cross-origin" })]);
  }
  // Asks for a link (and a title); a new link starts as wide, or upright for YouTube Shorts.
  function askVideo(v, done) {
    var link = el("input", { type: "url", dir: "ltr", "class": "pe-input", "data-video-url": "", value: v ? v.url || "" : "", placeholder: "https://youtu.be/…" });
    var title = el("input", { type: "text", dir: he ? "rtl" : "ltr", "class": "pe-input", "data-video-title": "", value: v ? v["title_" + lang] || "" : "" });
    var msg = el("p", { "class": "pe-note pe-video-msg", role: "status", "aria-live": "polite" });
    var ok = button(T.ok, function () {
      var u = link.value.trim();
      if (!parseVideo(u)) { msg.textContent = T.badVideo; link.focus(); return; }
      close();
      var item = v || { url: "", file: "", title_en: "", title_he: "" };
      item.url = u;
      item["title_" + lang] = title.value.trim();
      if (!v) item.shape = /youtube\.com\/shorts\//.test(u) ? "tall" : "wide";
      done(item);
    }, "pe-btn pe-primary");
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": v ? T.changeLink : T.addVideo }, [
      el("div", { "class": "pe-modal-box pe-small-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: v ? T.changeLink : T.addVideo }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("div", { "class": "pe-modal-foot" }, [
          el("label", {}, [document.createTextNode(T.videoUrl), link]),
          el("p", { "class": "pe-note", text: T.videoUrlHint }),
          el("label", {}, [document.createTextNode(T.videoTitle), title]),
          msg,
          ok,
        ]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") { e.preventDefault(); ok.click(); } }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dialog);
    link.focus();
  }
  // The videos area moves past the next shown area (pictures or videos) before or after it.
  function moveSection(s, dir) {
    var j = s + dir;
    while (j >= 0 && j < data.sections.length && !(data.sections[j] && data.sections[j].hidden !== true && /^(gallery|behind|videos)$/.test(data.sections[j].type))) j += dir;
    if (j < 0 || j >= data.sections.length) return;
    var tmp = data.sections[s]; data.sections[s] = data.sections[j]; data.sections[j] = tmp;
    changed();
  }
  function videosBlock(sec, s) {
    var box = el("section", { "class": "project-section pe-videos-sec", "data-videos": String(s) });
    var head = el("h2", { "class": "section-label", "data-ts": "project/section-title" });
    head.textContent = sec["heading_" + lang] || "";
    editable(head, T.videoHeading2, function (txt) { sec["heading_" + lang] = clean(txt).replace(/\n+/g, " "); });
    head.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); head.blur(); } });
    box.appendChild(head);
    box.appendChild(el("div", { "class": "pe-gal-tools" }, [
      button(T.sectionUp, function () { moveSection(s, -1); }, "pe-btn pe-sec-up", T.sectionUpTip),
      button(T.sectionDown, function () { moveSection(s, 1); }, "pe-btn pe-sec-down", T.sectionDownTip),
      button(T.removeArea, function () { data.sections.splice(s, 1); changed(); setStatus(T.areaRemoved, "warn"); }, "pe-btn pe-danger pe-sec-remove"),
      el("span", { "class": "pe-note", text: T.videosNote }),
    ]));
    var list = el("div", { "class": "pe-video-list" });
    sec.items.forEach(function (v, i) {
      if (!v) return;
      var cap = el("p", { "class": "video-title pe-video-title", "data-ts": "project/video-title" });
      cap.textContent = v["title_" + lang] || "";
      editable(cap, T.videoTitle, function (txt) { v["title_" + lang] = clean(txt).replace(/\n+/g, " "); });
      cap.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cap.blur(); } });
      var tools = [
        button(T.prevBtn, function () { if (i > 0) { sec.items.splice(i - 1, 0, sec.items.splice(i, 1)[0]); changed(); } }, "pe-btn pe-move", T.earlier),
        button(T.nextBtn, function () { if (i < sec.items.length - 1) { sec.items.splice(i + 1, 0, sec.items.splice(i, 1)[0]); changed(); } }, "pe-btn pe-move", T.later),
      ];
      if (parseVideo(v.url)) {
        tools.push(button(T.changeLink, function () { askVideo(v, function () { changed(); }); }, "pe-btn"));
        tools.push(selectBox(T.shape, isTall(v) ? "tall" : "wide", [["wide", T.wide], ["tall", T.tall]], function (val) { v.shape = val; changed(); }));
      }
      tools.push(button(T.remove.split(" ")[0], function () { sec.items.splice(i, 1); changed(); setStatus(T.videoRemoved, "warn"); }, "pe-btn pe-danger"));
      list.appendChild(el("figure", { "class": "video-item pe-video" + (isTall(v) ? " is-tall" : ""), "data-video": String(i) }, [player(v), cap, el("div", { "class": "pe-tools pe-video-tools" }, tools)]));
    });
    box.appendChild(list);
    box.appendChild(el("div", { "class": "pe-add" }, [
      button("+ " + T.addVideo, function () { askVideo(null, function (item) { sec.items.push(item); changed(); }); }, "pe-btn pe-add-one"),
      // Another area right after this one, starting with its first video.
      button("+ " + T.newArea, function () {
        askVideo(null, function (item) {
          data.sections.splice(s + 1, 0, { type: "videos", hidden: false, heading_en: "", heading_he: "", items: [item] });
          changed();
        });
      }, "pe-btn pe-new-area", T.newAreaTip),
    ]));
    return box;
  }

  function removeAt(sec, g) {
    var at = sec.images.indexOf(g);
    if (at < 0) return;
    sec.images.splice(at, 1);
    changed();
    setStatus(T.removed, "warn");
  }

  function cell(sec, s, g, i, it, grid) {
    var r = ratioOf(g);
    var media = el("span", { "class": "jg-media" }, [picture(g.image, "(max-width: 560px) 100vw, (max-width: 1100px) 50vw, 40vw", redraw)]);
    media.style.aspectRatio = String(r);
    var fig = el("figure", { "class": "jg-item pe-item" + (FRAMES[g.frame] ? " fit-cover focus-" + (g.focus || "center") : ""), draggable: "true", title: T.drag }, [media]);
    if (it && it.single) { fig.classList.add("pe-alone"); fig.style.width = it.single + "%"; }
    else if (it && it.grow) { fig.style.flex = it.grow + " 1 0"; fig.style.minWidth = "0"; media.style.aspectRatio = String(it.ar); media.classList.add("pe-crop"); }
    else { fig.style.flexGrow = String(Math.round(r * 100)); fig.style.flexBasis = "calc(var(--row-h) * " + r + ")"; }
    if (!narrow.matches) frame(fig, {
      start: function () { return fig.getBoundingClientRect().width / (grid.getBoundingClientRect().width || 1) * 100; },
      area: function () { return grid.getBoundingClientRect().width; },
      live: function (pct) { fig.style.flex = "none"; fig.style.width = pct + "%"; },
      done: function (pct) {
        // The first resize keeps every other picture at its current size.
        if (!isFree(sec)) {
          var gw = grid.getBoundingClientRect().width || 1;
          Array.prototype.forEach.call(grid.querySelectorAll(".pe-item"), function (n) {
            var other = n.__pic;
            if (other && other !== g) other.fw = Math.max(10, Math.min(100, Math.round(n.getBoundingClientRect().width / gw * 100)));
          });
        }
        g.fw = pct; selected = g; changed();
      },
      selectedNow: selected === g,
    });
    fig.__pic = g;
    if (uploads[norm(g.image)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
    if (!g["alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
    touchPick(fig, g);
    // Arrows follow the reading direction: "earlier" points right in Hebrew.
    fig.appendChild(el("div", { "class": "pe-tools" }, [
      button(T.prevBtn, function () { move(sec, g, -1); }, "pe-btn pe-move", T.earlier),
      button(T.nextBtn, function () { move(sec, g, 1); }, "pe-btn pe-move", T.later),
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
      if (e.target && e.target.closest && e.target.closest(".pe-tools, .pe-dot")) { e.preventDefault(); return; }
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
  // ---------- free sizes (computers) ----------
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
  if (narrow.addEventListener) narrow.addEventListener("change", function () { if (data) render(); });
  var selected = null; // the picture whose frame stays selected after a resize
  var selectedCover = false;
  function isFree(sec) { return sec.images.some(function (g) { return g && g.visible !== false && Number(g.fw) >= 10; }); }
  // Which choice of "size of all pictures" matches the pictures now.
  function sameWidth(list) {
    if (!list.some(function (it) { return Number(it.g.fw) >= 10; })) return "auto";
    var w = list.map(function (it) { return Number(it.g.fw) || 0; });
    for (var n = 1; n <= 4; n++) if (w.every(function (x) { return x === Math.floor(100 / n); })) return String(n);
    return "free";
  }
  // Same rule as the site (src/render.js freeClasses): rows filled in order,
  // pictures sharing a row fill it with one common height.
  function freeRows(list) {
    var rows = [], row = [], sum = 0;
    list.forEach(function (it) {
      var f = Number(it.g.fw) || 33;
      if (row.length && sum + f > 106) { rows.push(row); row = []; sum = 0; }
      row.push(it); sum += f;
    });
    if (row.length) rows.push(row);
    rows.forEach(function (rw) {
      var f = rw.map(function (it) { return Number(it.g.fw) || 33; });
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
  // Selection frame: click a picture, drag a dot to resize (width in %).
  function deselectAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".pe-selected"), function (n) { n.classList.remove("pe-selected"); });
  }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".pe-framed, .pe-modal")) { deselectAll(); selected = null; selectedCover = false; } });
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
        var area = o.area() || 1;
        var rd = dot.getBoundingClientRect(), b = box.getBoundingClientRect();
        var right = rd.left + rd.width / 2 > b.left + b.width / 2, bottom = pos.charAt(0) === "s";
        var pct = Math.round(startPct);
        box.classList.add("is-resizing", "pe-selected");
        try { dot.setPointerCapture(e.pointerId); } catch (x) { /* old browser */ }
        function mv(ev) {
          var dx = (ev.clientX - startX) * (right ? 1 : -1);
          var dy = pos.length === 2 ? (ev.clientY - startY) * (bottom ? 1 : -1) * (b.width / Math.max(1, b.height)) : 0;
          var d = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
          pct = Math.max(o.min || 10, Math.min(100, Math.round(startPct + d / area * 100)));
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
      el("ol", {}, (touch.matches ? [T.tip1, T.tipTouch, T.tip3, T.tipVideo, T.tip4] : [T.tip1, T.tip2, T.tip3, T.tipVideo, T.tip4]).map(function (t) { return el("li", { text: t }); })),
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
    if (!siteWatch.available || !commitSha) { setStatus(T.saved + trNote(), trKind()); return; }
    siteWatch.savedCommit = commitSha; siteWatch.started = Date.now();
    setStatus(T.publishing + trNote(), trKind());
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
  var trPairs = function () { return [{ now: data, before: JSON.parse(original) }]; };
  function trNote() { var n = window.BubaTranslate ? window.BubaTranslate.note(trRes) : ""; return n ? " " + n : ""; }
  function trKind() { return trRes.failed ? "warn" : "ok"; }
  function save() {
    if (!dirty() || translating) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    translating = true; saveBtn.disabled = true; trRes = { n: 0 };
    trReady
      .then(function () { return window.BubaTranslate ? window.BubaTranslate.run(trPairs(), { onStart: function (m) { setStatus(m); }, topOnly: true }) : { n: 0 }; })
      .then(function (r) { trRes = r; }, function () { trRes = { n: 0, failed: true }; })
      .then(function () { translating = false; saveNow(); });
  }
  function saveNow() {
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
    var fileChanged = JSON.stringify(data) !== original;
    chain
      .then(function () { return fileChanged ? api("/contents/" + encPath(FILE) + ref) : null; })
      .then(function (cur) {
        if (!fileChanged) return null;
        if (cur.sha !== sha) { var err = new Error("changed"); err.changed = true; throw err; }
        return api("/contents/" + encPath(FILE), { method: "PUT", body: { message: "Project " + SLUG + ": edited on the page", content: utf8ToB64(JSON.stringify(data, null, 2) + "\n"), sha: sha, branch: BRANCH } });
      })
      .then(function (res) {
        if (res) { sha = res.content.sha; original = JSON.stringify(data); }
        return window.BubaStyle ? window.BubaStyle.save("project " + SLUG) : "";
      })
      .then(function (c) {
        if (c) lastCommit = c;
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
    leaving = true;
    location.reload();
  }
})();

/*
 * BubaPix: editing the homepage on the page itself (owner only).
 *
 * Loaded only when the owner presses "Edit on the page" in the edit bar,
 * which itself appears only in a browser where the owner switched edit
 * buttons on. Nothing here runs for visitors.
 *
 * What it does: reads the homepage settings (content/site.json) from the
 * GitHub repository, lets the owner reorder, resize, hide, add and replace
 * pictures and edit the opening sentence right on the page, and saves the
 * file back to the work branch with the owner's own GitHub sign-in (the one
 * saved in this browser by the admin panel). The live site is not touched:
 * the work branch is published only to the private test site.
 *
 * It never decides which project a picture belongs to: project links are
 * kept exactly as they are, and new pictures get no project.
 */
(function boot() {
  "use strict";
  // The parts all the editors share (js/editor-core.js, loaded first by js/main.js).
  // A page from before js/main.js did this (the browser can keep a page for
  // a few minutes after an update) loads only the editor: then the editor
  // loads the shared file itself and starts again.
  // An older copy of the shared file (kept by the browser) lacks what this
  // editor needs (core.version): then it is loaded again, past the browser's copy.
  var core = window.BubaCore;
  if (!core || !(core.version >= 10)) {
    if (window.__bubapixCoreLoading) return;
    var tries = window.__bubapixCoreTries = (window.__bubapixCoreTries || 0) + 1;
    var me = document.currentScript, lb = document.querySelector("[data-page-editor]");
    var given = lb && lb.getAttribute("data-core-src");
    var coreSrc = given || (me && me.src ? me.src.replace(/[^/]*$/, "editor-core.js") : "");
    if (!coreSrc || tries > 2) return;
    if (core || tries > 1 || !given) coreSrc += (coreSrc.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
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
  if (!launcher) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var FILE = "content/site.json";
  var lang = document.documentElement.lang === "he" ? "he" : "en";
  var he = lang === "he";

  var T = he ? {
    title: "עריכה על הדף",
    loading: "טוען את הגדרות הדף…",
    save: "שמירה",
    saving: "שומר…",
    cancel: "יציאה בלי לשמור", backToView: "חזרה לתצוגה", backToViewTip: "אין שינויים: חוזרים לדף כפי שהגולשים רואים אותו",
    close: "סגירה",
    saved: "נשמר. אתר הבדיקה יתעדכן תוך כמה דקות (האתר החי לא משתנה).",
    unsaved: "יש שינויים שלא נשמרו",
    noChanges: "אין שינויים",
    perRow: "בשורה במחשב",
    perRowPhone: "בשורה בטלפון",
    gap: "רווח",
    mixed: "משתנה",
    gapNone: "ללא", gapMin: "מינימלי", gapSmall: "קטן", gapMedium: "בינוני",
    size: "גודל",
    sizeAuto: "אוטומטי", sizeLarge: "גדולה", sizeMedium: "בינונית", sizeSmall: "קטנה",
    frame: "צורה",
    frameNatural: "טבעית", frameWide: "קולנוע רחב", frameLandscape: "רוחבית", frameSquare: "ריבועית", framePortrait: "לאורך",
    earlier: "הזזה למקום הקודם", later: "הזזה למקום הבא", prevBtn: "→ קודם", nextBtn: "הבא ←", more: "⋯ עוד", drag: "גררו כדי להזיז",
    replace: "החלפה", cut: "גזירה", cutCancel: "ביטול גזירה", pasteHere: "הדבקה כאן", pasteEnd: "הדבקה בסוף", cutNote: "התמונה נגזרה. לחצו ״הדבקה כאן״ על התמונה שלפניה היא תיכנס, או ״הדבקה בסוף״.", alone: "לבד בשורה", aloneOff: "ביטול לבד בשורה", hide: "הסתרה", show: "הצגה", remove: "מחיקה",
    add: "הוספת תמונה לגלריה",
    describe: "תיאור לעיוורים", noAlt: "אין תיאור לעיוורים", ok: "אישור",
    altEdit: "כתבו בקצרה מה רואים בתמונה. קוראי מסך מקריאים את זה לגולשים עיוורים.",
    caption: "כותרת ותיאור", captionTitle: "כותרת לתמונה (לא חובה)", captionNote: "תיאור קצר (לא חובה)", captionWhere: "איפה להציג",
    capHidden: "לא להציג (נשמר)", capHome: "להציג בגלריה של דף הבית", capShow: "להציג", capPoster: "להציג עם הפוסטר",
    captionNoteHelp: "הכותרת והתיאור מתורגמים לאנגלית בשמירה. תיאור לעיוורים — בכפתור ״תיאור לעיוורים״.",
    hiddenTitle: "תמונות מוסתרות (נשמרות, לא מוצגות)",
    elsewhereTitle: "מוצגות במקום אחר בדף (פתיחה או שורת הפוסטרים), ולכן לא בגלריה",
    replaceHero: "החלפת תמונת הפתיחה",
    replaceFeature: "החלפת התמונה השנייה",
    removeFeature: "הסרת התמונה השנייה",
    addFeature: "הוספת תמונה שנייה",
    taglineHint: "לחצו על המשפט כדי לערוך אותו",
    textHint: "לחצו כדי לשנות את הטקסט",
    textEmptyBack: "הטקסט ריק, ולכן יוצג הטקסט הרגיל.",
    textNoEmpty: "השם לא יכול להיות ריק. השם הקודם הוחזר.",
    taglineEmpty: "משפט הפתיחה לא יכול להיות ריק (אחרת יוצג במקומו המשפט בשפה השנייה). המשפט הקודם הוחזר.",
    servicesNote: "שמות השירותים והכותרת ״שירותים״ משתנים גם בדף השירותים ובתפריט. בשפת הדף בלבד.",
    posterSizeNote: "פוסטרים: גודל — לוחצים על פוסטר וגוררים נקודה כחולה (במחשב). סדר — גוררים פוסטר או חצים. הסדר כאן הוא של דף הבית בלבד.",
    posterTouchNote: "פוסטרים: נוגעים בפוסטר כדי לבחור אותו, ואז ״→ קודם״ או ״הבא ←״ לשינוי הסדר. הסדר כאן הוא של דף הבית בלבד. גודל: גוררים נקודה כחולה (לא בטלפון).",
    posterAuto: "גודל אוטומטי לכל הפוסטרים",
    pickTitle: "בחירת תמונה",
    pickUpload: "העלאה מהמחשב",
    pickLoading: "טוען תמונות…",
    altHe: "תיאור התמונה לעיוורים, עברית (רשות)",
    altEn: "תיאור התמונה לעיוורים, אנגלית (רשות)",
    altNote: "התיאור הקודם נמחק כי התמונה התחלפה. כתבו תיאור למה שרואים בתמונה.",
    choose: "בחירה",
    pickMany: "אפשר לבחור כמה תמונות: לוחצים על כל תמונה שרוצים (לחיצה נוספת מבטלת), או מעלים כמה קבצים יחד. כל התמונות שנבחרו נוספות בבת אחת.",
    manyAlt: "כשנבחרו כמה תמונות, את התיאור לעיוורים כותבים אחר כך לכל תמונה (״תיאור לעיוורים״).",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״פתיחת העריכה המתקדמת״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את הגדרות הדף מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא השתנה.",
    errPartial: "חלק מהשינויים נשמרו וחלק לא. רעננו את הדף ובדקו.",
    errChanged: "הגדרות הדף השתנו בינתיים במקום אחר (למשל בכלי הניהול). כדי לא למחוק את השינוי ההוא, לא שמרתי. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    newBadge: "חדשה",
    project: "פרויקט",
    noProject: "ללא פרויקט",
    projectHint: "לחיצה על התמונה תפתח את דף הפרויקט שתבחרו",
    toPage: "להוסיף את התמונה גם לגלריה בדף הפרויקט",
    pickProject: "שיוך לפרויקט (רשות, לפי בחירתכם)",
    projectsBtn: "פרויקטים: שמות ופרויקט חדש",
    projectsTitle: "פרויקטים",
    nameHe: "שם בעברית",
    nameEn: "שם באנגלית",
    address: "כתובת העמוד",
    addressHint: "אותיות באנגלית, מספרים ומקפים. נקבעת פעם אחת ולא משתנה כשמשנים שם.",
    newProject: "פרויקט חדש",
    create: "יצירת הפרויקט",
    cover: "תמונת שער (רשות)",
    chooseCover: "בחירת תמונת שער",
    noImageNote: "פרויקט מופיע באתר רק כשיש לו לפחות תמונה אחת (תמונת שער, או תמונה שהוספתם לדף שלו).",
    errName: "כתבו שם לפרויקט.",
    errAddress: "כתובת העמוד: אותיות באנגלית קטנות, מספרים ומקפים בלבד.",
    errTaken: "כבר יש פרויקט עם הכתובת הזאת.",
    created: "נוסף. הוא יישמר כשתלחצו ״שמירה״.",
    open: "פתיחת הדף",
    newMark: "חדש, לא נשמר עדיין",
    undo: "ביטול פעולה",
    undoTip: "ביטול הפעולה האחרונה (Ctrl+Z)",
    nothingToUndo: "אין מה לבטל",
    undone: "הפעולה בוטלה",
    history: "גרסאות קודמות",
    historyTitle: "גרסאות קודמות של דף הבית",
    historyNote: "בחירה בגרסה טוענת אותה לדף כשינוי שלא נשמר. רק ״שמירה״ קובעת. אפשר לבטל עם ״ביטול פעולה״.",
    historyLoaded: "גרסה קודמת נטענה לדף. בדקו ולחצו ״שמירה״ כדי לקבוע אותה.",
    publishing: "נשמר ✓ אתר הבדיקה מתעדכן עכשיו (בדרך כלל עד כמה דקות). אפשר להמשיך לעבוד.",
    published: "האתר עודכן ✓",
    reload: "רעננו כדי לראות",
    slow: "העדכון לוקח יותר מהרגיל. השינוי שמור; אפשר לבדוק שוב בעוד כמה דקות.",
    tipTitle: "איך עורכים",
    tip1: "גודל: לוחצים על תמונה (גם תמונות הפתיחה), ומופיעה מסגרת עם נקודות. גוררים נקודה — התמונה גדלה או קטנה, והשורה מסתדרת לבד בלי רווחים. הכלים (צורה, פרויקט, החלפה, הסתרה) מופיעים כשמעבירים עכבר על תמונה.",
    tipTouch: "בטלפון ובטאבלט: נוגעים בתמונה או בפוסטר כדי לבחור אותם, והכלים מופיעים מתחתיהם. נגיעה נוספת מבטלת את הבחירה. נגיעה בתמונה לא משנה כלום בעצמה.",
    tip2: "גוררים תמונה כדי לשנות את הסדר, או משתמשים בחצים.",
    tip3: "כל טקסט בדף ניתן לעריכה: לוחצים עליו וכותבים (משפט הפתיחה, שירותים, ״לכל השירותים״, ״התחילו פרויקט״, השורה בתחתית). פוסטרים: גוררים נקודה לגודל, גוררים את הפוסטר או חצים לסדר.",
    tip4: "שום דבר לא נשמר עד ״שמירה״. טעיתם? ״ביטול פעולה״.",
    tipClose: "הבנתי",
    help: "עזרה",
    resizeTip: "גררו את הפינה כדי לשנות גודל",
    widthLabel: "רוחב",
    freeMode: "חופשי: גודל לכל תמונה",
    frameTip: "לחצו על תמונה כדי לבחור אותה, ואז גררו את הנקודות שבמסגרת כדי לשנות גודל",
    posterReplace: "החלפת הפוסטר",
    postersNotLoaded: "חלק מהפוסטרים לא נטענו לעריכה (הם מוצגים כרגיל). רעננו את הדף כדי לערוך אותם.", posterHide: "הורדה מהשורה",
    posterShow: "הצגה בשורה",
    posterHiddenNote: "יוסתר מהשורה אחרי שמירה",
    postersHiddenTitle: "פוסטרים מוסתרים משורת הפרויקטים",
    posterNote: "התמונה שנבחרת כאן היא הפוסטר של דף הבית בלבד. תמונת השער בעמוד הפרויקטים ובדף הפרויקט לא משתנה.",
    featureSize: "רוחב",
    featureSmall: "צר", featureMedium: "בינוני", featureLarge: "רחב", featureFull: "כל הרוחב",
  } : {
    title: "Edit on the page",
    loading: "Loading the page settings…",
    save: "Save",
    saving: "Saving…",
    cancel: "Leave without saving", backToView: "Back to the page", backToViewTip: "No changes: back to the page as visitors see it",
    close: "Close",
    saved: "Saved. The test site updates within a few minutes (the live site does not change).",
    unsaved: "Unsaved changes",
    noChanges: "No changes",
    perRow: "per row on computers",
    perRowPhone: "per row on phones",
    gap: "Space",
    mixed: "Mixed",
    gapNone: "None", gapMin: "Minimal", gapSmall: "Small", gapMedium: "Medium",
    size: "Size",
    sizeAuto: "Automatic", sizeLarge: "Large", sizeMedium: "Medium", sizeSmall: "Small",
    frame: "Shape",
    frameNatural: "Natural", frameWide: "Cinema wide", frameLandscape: "Landscape", frameSquare: "Square", framePortrait: "Portrait",
    earlier: "Move to the previous place", later: "Move to the next place", prevBtn: "← Earlier", nextBtn: "Later →", more: "⋯ More", drag: "Drag to move",
    replace: "Replace", cut: "Cut", cutCancel: "Cancel cut", pasteHere: "Paste here", pasteEnd: "Paste at the end", cutNote: "Picture cut. Press \"Paste here\" on the picture it should go before, or \"Paste at the end\".", alone: "Alone in its row", aloneOff: "Undo alone in row", hide: "Hide", show: "Show", remove: "Delete",
    add: "Add a picture to the gallery",
    describe: "Description for blind visitors", noAlt: "No description for blind visitors", ok: "OK",
    altEdit: "Say briefly what the picture shows. Screen readers read it to blind visitors.",
    caption: "Title and text", captionTitle: "Picture title (optional)", captionNote: "Short text (optional)", captionWhere: "Where to show it",
    capHidden: "Not shown (kept)", capHome: "Show in the homepage gallery", capShow: "Show", capPoster: "Show with the poster",
    captionNoteHelp: "The title and text are translated to Hebrew on saving. The description for blind visitors is under \"Description for blind visitors\".",
    hiddenTitle: "Hidden pictures (kept, not shown)",
    elsewhereTitle: "Shown elsewhere on the page (opening or posters row), so not in the gallery",
    replaceHero: "Replace the opening image",
    replaceFeature: "Replace the second picture",
    removeFeature: "Remove the second picture",
    addFeature: "Add a second picture",
    taglineHint: "Click the sentence to edit it",
    textHint: "Click to change the text",
    textEmptyBack: "The text is empty, so the usual text will show.",
    textNoEmpty: "The name cannot be empty. The previous name is back.",
    taglineEmpty: "The opening sentence cannot be empty (the other language's sentence would show instead). The previous sentence is back.",
    servicesNote: "Service names and the \"Services\" heading also change on the services page and in the menu, in this language only.",
    posterSizeNote: "Posters: size — click a poster and drag a blue dot (on computers). Order — drag a poster or use the arrows. This order is for the homepage only.",
    posterTouchNote: "Posters: tap a poster to choose it, then \"← Earlier\" or \"Later →\" to change the order. This order is for the homepage only. Size: drag a blue dot (not on phones).",
    posterAuto: "Automatic size for all posters",
    pickTitle: "Choose a picture",
    pickUpload: "Upload from this computer",
    pickLoading: "Loading pictures…",
    altHe: "Description for blind visitors, Hebrew (optional)",
    altEn: "Description for blind visitors, English (optional)",
    altNote: "The old description was cleared because the picture changed. Describe what the picture shows.",
    choose: "Choose",
    pickMany: "You can choose several pictures: tap each picture you want (tap again to unselect), or upload several files at once. All the chosen pictures are added together.",
    manyAlt: "With several pictures chosen, write each picture's description for blind visitors afterwards (\"Description for blind visitors\").",
    signIn: "To edit, sign in once to the admin panel in this browser (\"All management\" → \"Open advanced editing\"), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the page settings from GitHub.",
    errSave: "Saving failed. Nothing was changed.",
    errPartial: "Some changes were saved and some were not. Reload the page and check.",
    errChanged: "The page settings were changed elsewhere in the meantime (for example in the admin panel). To keep that change, nothing was saved. Leave editing, reload the page and try again.",
    errAuth: "The sign-in expired or has no permission. Sign in to the admin panel again and retry.",
    leave: "There are unsaved changes. Leave anyway?",
    newBadge: "new",
    project: "Project",
    noProject: "No project",
    projectHint: "Clicking the picture opens the project page you choose",
    toPage: "Also add the picture to the gallery on the project page",
    pickProject: "Project (optional, your choice)",
    projectsBtn: "Projects: names and new project",
    projectsTitle: "Projects",
    nameHe: "Hebrew name",
    nameEn: "English name",
    address: "Page address",
    addressHint: "English letters, numbers and dashes. Set once; it does not change when the name changes.",
    newProject: "New project",
    create: "Create the project",
    cover: "Cover image (optional)",
    chooseCover: "Choose a cover image",
    noImageNote: "A project appears on the site only once it has at least one picture (a cover, or a picture added to its page).",
    errName: "Write a name for the project.",
    errAddress: "Page address: small English letters, numbers and dashes only.",
    errTaken: "A project with this address already exists.",
    created: "Added. It is saved when you press \"Save\".",
    open: "Open the page",
    newMark: "new, not saved yet",
    undo: "Undo",
    undoTip: "Undo the last action (Ctrl+Z)",
    nothingToUndo: "Nothing to undo",
    undone: "Undone",
    history: "Earlier versions",
    historyTitle: "Earlier versions of the homepage",
    historyNote: "Choosing a version loads it onto the page as an unsaved change. Only \"Save\" makes it final. You can undo it.",
    historyLoaded: "An earlier version is loaded on the page. Check it and press \"Save\" to keep it.",
    publishing: "Saved ✓ The test site is updating now (usually a few minutes). You can keep working.",
    published: "The site is updated ✓",
    reload: "Reload to see it",
    slow: "The update is taking longer than usual. The change is saved; check again in a few minutes.",
    tipTitle: "How to edit",
    tip1: "Size: click a picture (the opening ones too) and a frame with dots appears. Drag a dot: the picture grows or shrinks and its row rearranges itself without gaps. Tools (shape, project, replace, hide) appear when you point at a picture.",
    tipTouch: "On phones and tablets: tap a picture or a poster to choose it, and its tools appear below it. Tap again to unselect. A tap on a picture changes nothing by itself.",
    tip2: "Drag a picture to change the order, or use the arrows.",
    tip3: "Every text on the page can be edited: click it and write (opening sentence, services, \"All services\", \"Start a project\", the line at the bottom). Posters: drag a dot to resize, drag the poster or use the arrows to reorder.",
    tip4: "Nothing is saved until \"Save\". Made a mistake? \"Undo\".",
    tipClose: "Got it",
    help: "Help",
    resizeTip: "Drag the corner to change the size",
    widthLabel: "Width",
    freeMode: "Free: a size for each picture",
    frameTip: "Click a picture to select it, then drag the dots on its frame to resize",
    posterReplace: "Replace the poster",
    postersNotLoaded: "Some posters could not be loaded for editing (they are shown as usual). Refresh the page to edit them.", posterHide: "Remove from the row",
    posterShow: "Show in the row",
    posterHiddenNote: "Hidden from the row after saving",
    postersHiddenTitle: "Posters hidden from the projects row",
    posterNote: "The picture chosen here is the homepage poster only. The cover on the projects page and the project page stays.",
    featureSize: "Width",
    featureSmall: "Narrow", featureMedium: "Medium", featureLarge: "Wide", featureFull: "Full width",
  };

  // ---------- small helpers ----------
  function select(label, value, options, onChange) {
    var s = el("select", { "aria-label": label, title: label, "class": "pe-select" });
    options.forEach(function (o) {
      var opt = el("option", { value: o[0], text: o[1] });
      if (String(value) === o[0]) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }
  var api = core.github(launcher, function (sha) { lastCommit = sha; }).api;
  var encPath = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };

  // Where the site's files are (the page may live in a sub-folder).
  var styleLink = document.querySelector('link[href*="css/styles.css"]');
  var BASE = styleLink ? styleLink.getAttribute("href").split("css/styles.css")[0] : "";
  var norm = function (p) { return String(p || "").replace(/^\//, ""); };
  var url = function (p) { return BASE + norm(p); };

  // Pictures already on the page: reuse their small sizes and proportions.
  var known = {};
  Array.prototype.forEach.call(document.querySelectorAll("img"), function (img) {
    var src = img.getAttribute("src") || "";
    if (BASE && src.indexOf(BASE) === 0) src = src.slice(BASE.length);
    known[norm(src)] = {
      srcset: img.getAttribute("srcset") || "",
      w: Number(img.getAttribute("width")) || 0,
      h: Number(img.getAttribute("height")) || 0,
    };
  });
  var posterSrcs = {};
  Array.prototype.forEach.call(document.querySelectorAll(".home-posters img"), function (img) {
    var src = img.getAttribute("src") || "";
    if (BASE && src.indexOf(BASE) === 0) src = src.slice(BASE.length);
    posterSrcs[norm(src)] = true;
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
  var projects = []; // { slug, name } from content/projects, for the owner's own choice
  // A poster's "Title and text" (kept in the project's file; cap: the fields, origCap: as loaded).
  // The poster's title and text, and its description for blind visitors (the
  // project's cover_alt_*, the same picture).
  var CAP_KEYS = ["poster_title_he", "poster_title_en", "poster_note_he", "poster_note_en", "poster_caption", "poster_caption_pos", "cover_alt_he", "cover_alt_en"];
  function capOf(d) { var c = {}; CAP_KEYS.forEach(function (k) { c[k] = d && typeof d[k] === "string" ? d[k] : ""; }); return c; }
  var pageAdds = {}; // project slug -> pictures to add to that project's page gallery
  var hasPageAdds = function () { return Object.keys(pageAdds).some(function (k) { return pageAdds[k].length; }); };
  // Existing projects changed here: names, cover (poster) or the posters row.
  var renamed = function () { return projects.filter(function (p) { return !p.isNew && (p.title_he !== p.orig_he || p.title_en !== p.orig_en || !!p.cover || p.in_posters !== p.orig_in_posters || p.order !== p.orig_order || p.poster_w !== p.orig_poster_w || p.poster_w_m !== p.orig_poster_w_m || JSON.stringify(p.cap || {}) !== (p.origCap || JSON.stringify(p.cap || {}))); }); };
  var created = function () { return projects.filter(function (p) { return p.isNew; }); };
  // Texts kept in other files: interface texts (content/labels.json) and the
  // services list (content/services.json). Changed here in the page's language.
  var texts = { labels: {}, services: null }, textsOrig = "", labelsSha = "", servicesSha = "";
  var textsDirty = function () { return !!textsOrig && JSON.stringify(texts) !== textsOrig; };
  // Text styles (js/text-style.js) are saved with the homepage too.
  var dirty = function () { return data && (JSON.stringify(data) !== original || hasPageAdds() || renamed().length > 0 || created().length > 0 || textsDirty() || !!(window.BubaStyle && window.BubaStyle.dirty())); };
  function displayName(p) { return (he ? p.title_he || p.title_en : p.title_en || p.title_he) || p.slug; }
  var projectName = function (slug) { var p = projects.filter(function (x) { return x.slug === slug; })[0]; return p ? p.name : slug; };
  function loadProjects() {
    return api("/contents/content/projects?ref=" + encodeURIComponent(BRANCH))
      .then(function (items) {
        var files = (Array.isArray(items) ? items : []).filter(function (f) { return f.type === "file" && /\.json$/.test(f.name); });
        // Each project file is read on its own (with one retry), so one failed
        // read leaves only that poster out of editing, never all of them.
        var get = function (f) { return api("/contents/" + encPath(f.path) + "?ref=" + encodeURIComponent(BRANCH)).catch(function () { return api("/contents/" + encPath(f.path) + "?ref=" + encodeURIComponent(BRANCH)); }); };
        return Promise.all(files.map(function (f) {
          return get(f).then(function (res) {
            var d = {};
            try { d = JSON.parse(b64ToUtf8(res.content)); } catch (e) { d = {}; }
            var slug = f.name.replace(/\.json$/, "");
            return { slug: slug, title_he: d.title_he || "", title_en: d.title_en || "", orig_he: d.title_he || "", orig_en: d.title_en || "", name: (he ? d.title_he || d.title_en : d.title_en || d.title_he) || slug, order: Number(d.poster_order) || Number(d.order) || 99, orig_order: Number(d.poster_order) || Number(d.order) || 99, poster_w: Number(d.poster_w) >= 10 ? Math.round(Number(d.poster_w)) : 0, orig_poster_w: Number(d.poster_w) >= 10 ? Math.round(Number(d.poster_w)) : 0, poster_w_m: Number(d.poster_w_m) >= 20 ? Math.round(Number(d.poster_w_m)) : 0, orig_poster_w_m: Number(d.poster_w_m) >= 20 ? Math.round(Number(d.poster_w_m)) : 0, in_posters: d.in_posters !== false, orig_in_posters: d.in_posters !== false, origCover: d.poster_image || d.cover || "", cover: null, cap: capOf(d), origCap: JSON.stringify(capOf(d)) };
          }).catch(function () { return null; });
        }));
      })
      .then(function (list) { projects = list.filter(Boolean).sort(function (a, b) { return a.order - b.order; }); })
      .catch(function () { projects = []; });
  }
  function loadTexts() {
    var get = function (path) {
      return api("/contents/" + encPath(path) + "?ref=" + encodeURIComponent(BRANCH))
        .then(function (res) { return { sha: res.sha, data: JSON.parse(b64ToUtf8(res.content) || "{}") }; })
        .catch(function (err) { if (err.status === 404) return { sha: "", data: null }; throw err; });
    };
    return Promise.all([get("content/labels.json"), get("content/services.json")]).then(function (r) {
      labelsSha = r[0].sha; servicesSha = r[1].sha;
      texts = { labels: r[0].data || {}, services: r[1].data };
      textsOrig = JSON.stringify(texts);
    });
  }
  function projectSelect(value, onChange) {
    var opts = [["", T.project + ": " + T.noProject]].concat(projects.map(function (p) { return [p.slug, T.project + ": " + displayName(p)]; }));
    // Keep an existing link even if that project is not in the list.
    if (value && !projects.some(function (p) { return p.slug === value; })) opts.push([value, T.project + ": " + value]);
    var s = select(T.project, value || "", opts, onChange);
    s.title = T.projectHint;
    return s;
  }
  // Remembers a picture to add to a project's page gallery when saving.
  function addToPage(slug, path, alts) {
    if (!slug) return;
    (pageAdds[slug] = pageAdds[slug] || []).push({ image: "/" + path, alt_he: alts.he, alt_en: alts.en });
  }

  // ---------- toolbar ----------
  var status = el("span", { "class": "pe-status", role: "status", "aria-live": "polite" });
  var saveBtn = button(T.save, save, "pe-btn pe-primary");
  var undoBtn = button("↶ " + T.undo, undo, "pe-btn", T.undoTip);
  undoBtn.disabled = true;
  // "Leave without saving" while there are changes; with none, "Back to the page".
  var exitBtn = button(T.cancel, quit, "pe-btn pe-ghost pe-exit");
  function exitLabel() { var d = false; try { d = dirty(); } catch (e) { d = false; } var t = d ? T.cancel : T.backToView; if (exitBtn.textContent !== t) { exitBtn.textContent = t; exitBtn.title = d ? T.cancel : T.backToViewTip; } }
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }),
    status,
    el("span", { "class": "pe-bar-actions" }, [undoBtn, saveBtn, exitBtn]),
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

  function setStatus(text, kind) {
    status.textContent = text || "";
    status.className = "pe-status" + (kind ? " is-" + kind : "");
  }
  // While saving, typing does not change the status or turn "Save" back on (no second save at the same time).
  var busy = false;
  function refreshStatus() { exitLabel();
    if (busy) return;
    setStatus(dirty() ? T.unsaved : T.noChanges, dirty() ? "warn" : "");
    saveBtn.disabled = !dirty();
  }
  // ---------- undo ----------
  // Every change keeps a copy of the state before it, in this tab only.
  var past = [], last = "";
  // A project's fields that say what is saved on GitHub (not edits).
  var SAVED_KEYS = ["isNew", "orig_he", "orig_en", "orig_order", "orig_poster_w", "orig_poster_w_m", "orig_in_posters", "origCover", "origCap"];
  var addedSaved = {}; // "slug|/picture" already added to a project's page by a save
  function snapshot() {
    return JSON.stringify({ data: data, projects: projects.map(function (p) { return { slug: p.slug, isNew: !!p.isNew, title_he: p.title_he, title_en: p.title_en, orig_he: p.orig_he, orig_en: p.orig_en, order: p.order, orig_order: p.orig_order, poster_w: p.poster_w || 0, orig_poster_w: p.orig_poster_w || 0, poster_w_m: p.poster_w_m || 0, orig_poster_w_m: p.orig_poster_w_m || 0, name: p.name, cover: p.cover || null, in_posters: p.in_posters !== false, orig_in_posters: p.orig_in_posters !== false, origCover: p.origCover || "", cap: p.cap || capOf(null), origCap: p.origCap || JSON.stringify(capOf(null)) }; }), pageAdds: pageAdds, texts: texts });
  }
  function commit() {
    if (!data) return;
    var now = snapshot();
    if (last && now !== last) { past.push(last); if (past.length > 100) past.shift(); }
    last = now;
    undoBtn.disabled = !past.length;
  }
  function undo() {
    if (!past.length) { setStatus(T.nothingToUndo); return; }
    var prev = JSON.parse(past.pop());
    // Undo brings back the edits, never an older idea of what is saved on GitHub:
    // a project created by a save stays created (and stays in the list), and
    // pictures already added to a project's page are not added again.
    var cur = {};
    projects.forEach(function (p) { cur[p.slug] = p; });
    prev.projects.forEach(function (p) {
      var c = cur[p.slug];
      if (!c) return;
      SAVED_KEYS.forEach(function (k) { p[k] = c[k]; });
      if (p.cover && "/" + p.cover.path === p.origCover) p.cover = null;
    });
    projects.forEach(function (c) { if (!c.isNew && !prev.projects.some(function (p) { return p.slug === c.slug; })) prev.projects.push(c); });
    Object.keys(prev.pageAdds || {}).forEach(function (slug) { prev.pageAdds[slug] = prev.pageAdds[slug].filter(function (a) { return !addedSaved[slug + "|" + a.image]; }); });
    data = prev.data; projects = prev.projects; pageAdds = prev.pageAdds; texts = prev.texts || texts;
    last = snapshot();
    undoBtn.disabled = !past.length;
    syncPage(); render(); fillTexts(); refreshStatus();
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
    saveBtn.disabled = true;
    return;
  }

  api("/contents/" + encPath(FILE) + "?ref=" + encodeURIComponent(BRANCH))
    .then(function (res) {
      sha = res.sha;
      data = JSON.parse(b64ToUtf8(res.content));
      if (!Array.isArray(data.gallery)) data.gallery = [];
      original = JSON.stringify(data);
      return Promise.all([loadProjects(), loadTexts()]);
    })
    .then(function () {
      start();
      last = snapshot();
      refreshStatus();
      watchSite();
      loadStyles();
    })
    .catch(function (err) {
      setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error");
      saveBtn.disabled = true;
    });
  function loadStyles() { core.loadStyles(launcher, refreshStatus); }

  var leaving = false;
  window.addEventListener("beforeunload", function (e) {
    if (!leaving && dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- page parts ----------
  var workSection = document.querySelector(".section-work");
  var mosaic = document.querySelector(".section-work [data-mosaic]");
  var editArea = el("div", { "class": "pe-area" });
  var opening = document.querySelector(".opening");

  var layoutSelects = {}, heroBox = null, featureBox = null, taglineEl = null, drawFeatureTools = function () {}, featureTools = null, shownHero = "", shownFeature = "";
  function start() {
    // Layout choices in the toolbar.
    var lay = bar.querySelector(".pe-bar-layout");
    lay.appendChild(layoutSelects.cols = select(T.perRow, data.gallery_columns || "mixed",
      [["mixed", T.mixed], ["2", "2"], ["3", "3"], ["4", "4"]].map(function (o, i) { return i ? [o[0], o[1] + " " + T.perRow] : [o[0], T.mixed + " " + T.perRow]; }).concat([["free", T.freeMode]]),
      function (v) {
        if (v === "free") { if (!isFree()) startFree(); }
        else { data.gallery_columns = v; data.gallery.forEach(function (g) { if (g) delete g.fw; }); }
        changed(); syncPage();
      }));
    lay.appendChild(layoutSelects.phone = select(T.perRowPhone, data.gallery_phone || "mixed",
      [["mixed", T.mixed + " " + T.perRowPhone], ["1", "1 " + T.perRowPhone], ["2", "2 " + T.perRowPhone]],
      function (v) { data.gallery_phone = v; changed(); }));
    lay.appendChild(layoutSelects.gap = select(T.gap, data.gallery_gap || "minimal",
      [["none", T.gap + ": " + T.gapNone], ["minimal", T.gap + ": " + T.gapMin], ["small", T.gap + ": " + T.gapSmall], ["medium", T.gap + ": " + T.gapMedium]],
      function (v) { data.gallery_gap = v; changed(); }));
    lay.appendChild(button(T.projectsBtn, projectsPanel));
    lay.appendChild(button(T.history, historyPanel));
    lay.appendChild(button("? " + T.help, function () { showTip(true); }, "pe-btn pe-ghost"));
    showTip(false);

    // Gallery: the editable version takes the place of the gallery.
    if (!workSection) {
      workSection = el("section", { "class": "section section-work" });
      var after = document.querySelector(".home-posters") || opening;
      if (after && after.parentNode) after.parentNode.insertBefore(workSection, after.nextSibling);
      else document.querySelector("main").appendChild(workSection);
    }
    if (mosaic) { mosaic.hidden = true; mosaic.style.display = "none"; }
    workSection.appendChild(editArea);

    setupOpening();
    setupPosters();
    setupTexts();
    render();
  }

  // ---------- texts on the page ----------
  // Each editable text: where it is on the page and where it is kept.
  var textParts = [];
  function plain(node, hint, onText, onBlur) {
    try { node.contentEditable = "plaintext-only"; } catch (e) { node.contentEditable = "true"; }
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.classList.add("pe-editable");
    node.setAttribute("title", hint);
    node.addEventListener("input", function () { onText(node.textContent.replace(/\s+/g, " ").trim()); refreshStatus(); });
    node.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); node.blur(); } });
    node.addEventListener("blur", function () { if (onBlur) onBlur(); commit(); });
    // A text inside a link or a button: clicking it edits, never leaves the page.
    node.addEventListener("click", function (e) { e.preventDefault(); }, true);
  }
  function labelPart(node, field) {
    if (!node) return;
    var key = field + "_" + lang, usual = node.textContent;
    textParts.push({ node: node, get: function () { return texts.labels[key] || usual; } });
    plain(node, T.textHint, function (v) { if (v) texts.labels[key] = v; else delete texts.labels[key]; }, function () {
      if (!texts.labels[key]) { node.textContent = usual; setStatus(T.textEmptyBack, "warn"); }
    });
  }
  function setupTexts() {
    labelPart(document.querySelector("#home-services-title"), "nav_services");
    labelPart(document.querySelector(".home-services .section-head a"), "all_services");
    // "Start a project": at the bottom of the page, and next to the heading at the top.
    Array.prototype.forEach.call(document.querySelectorAll(".start-project a.button, .home-head a.home-cta"), function (b) { labelPart(b, "start_project"); });
    labelPart(document.querySelector("main > .bottom-hint"), "home_hint");
    labelPart(document.querySelector("#showreel-title"), "showreel");
    var intro = document.querySelector(".intro-text");
    if (intro) {
      textParts.push({ node: intro, get: function () { return data["intro_" + lang] || ""; } });
      plain(intro, T.textHint, function (v) { data["intro_" + lang] = v; });
    }
    // Service names: matched to the services file by their shown name.
    var list = texts.services && Array.isArray(texts.services.services) ? texts.services.services : [];
    var other = he ? "en" : "he", used = {};
    Array.prototype.forEach.call(document.querySelectorAll(".home-service-list li"), function (li) {
      var shown = li.textContent.trim(), at = -1;
      list.forEach(function (sv, i) { if (at < 0 && !used[i] && ((sv["name_" + lang] || sv["name_" + other] || "").trim() === shown)) at = i; });
      if (at < 0) return;
      used[at] = true;
      var sv = list[at], key = "name_" + lang;
      textParts.push({ node: li, get: function () { var s2 = texts.services.services[at]; return s2[key] || s2["name_" + other] || ""; } });
      plain(li, T.textHint, function (v) { texts.services.services[at][key] = v; }, function () {
        if (!texts.services.services[at][key]) { var o = JSON.parse(textsOrig).services.services[at][key]; texts.services.services[at][key] = o; li.textContent = o || shown; setStatus(T.textNoEmpty, "warn"); }
      });
      void sv;
    });
    var head = document.querySelector(".home-services .section-head");
    if (head) head.parentNode.insertBefore(el("p", { "class": "pe-note", text: T.servicesNote }), head.nextSibling);
  }
  function fillTexts() {
    textParts.forEach(function (t) { if (document.activeElement !== t.node) t.node.textContent = t.get(); });
  }

  // ---------- opening: two pictures and the sentence ----------
  function setupOpening() {
    if (!opening) return;
    heroBox = opening.querySelector(".opening-hero");
    featureBox = opening.querySelector(".opening-feature");
    shownHero = norm(data.hero_image); shownFeature = norm(data.feature_image);
    var openingWidth = function () { return opening.getBoundingClientRect().width || 1; };
    // On a phone the dots set the phone sizes (hero_w_m, feature_w_m); computers keep hero_w, feature_w.
    var heroKey = phone.matches ? "hero_w_m" : "hero_w", featureKey = phone.matches ? "feature_w_m" : "feature_w";
    if (heroBox) frame(heroBox, {
      start: function () { return heroBox.getBoundingClientRect().width / openingWidth() * 100; },
      area: openingWidth, centred: true, min: 20, max: 100,
      live: function (pct) { heroBox.style.maxWidth = pct + "%"; heroBox.style.marginInline = "auto"; },
      done: function (pct) { if (pct >= 100) delete data[heroKey]; else data[heroKey] = pct; changed(); syncPage(); },
    });
    if (heroBox) {
      heroBox.classList.add("pe-holder");
      heroBox.appendChild(el("div", { "class": "pe-tools pe-tools-top" }, [
        button(T.replaceHero, function () {
          pick(function (path, alts, choice) {
            addToPage(choice.toPage && choice.project, path, alts);
            data.hero_image = "/" + path;
            data.hero_alt_he = alts.he; data.hero_alt_en = alts.en;
            changed(); syncPage();
          });
        }),
        button(T.describe, function () {
          core.describe(T, data.hero_alt_he, data.hero_alt_en, function (alts) { data.hero_alt_he = alts.he; data.hero_alt_en = alts.en; changed(); syncPage(); });
        }, "pe-btn pe-describe-btn"),
        button(T.caption, function () {
          // When the opening picture is also a gallery picture, the site shows that picture's title
          // and text; otherwise the opening picture's own (hero_title_*, hero_note_*).
          var g = heroInGallery();
          if (g) core.captionDialog(T, g, lang, [["hidden", T.capHidden], ["everywhere", T.capShow]], function () { changed(); syncPage(); });
          else core.captionDialog(T, data, lang, [["hidden", T.capHidden], ["everywhere", T.capShow]], function () { changed(); syncPage(); }, "hero_");
        }, "pe-btn pe-caption-btn"),
      ]));
    }
    featureTools = el("div", { "class": "pe-tools pe-tools-top" });
    drawFeatureTools = function () {
      featureTools.textContent = "";
      if (data.feature_image) featureTools.appendChild(select(T.featureSize, data.feature_size || "small",
        [["small", T.featureSize + ": " + T.featureSmall], ["medium", T.featureSize + ": " + T.featureMedium], ["large", T.featureSize + ": " + T.featureLarge], ["full", T.featureSize + ": " + T.featureFull]],
        function (v) { data.feature_size = v; delete data.feature_w; changed(); syncPage(); }));
      featureTools.appendChild(button(data.feature_image ? T.replaceFeature : T.addFeature, function () {
        pick(function (path, alts, choice) {
          addToPage(choice.toPage && choice.project, path, alts);
          data.feature_project = choice.project || "";
          data.feature_image = "/" + path;
          data.feature_alt_he = alts.he; data.feature_alt_en = alts.en;
          changed(); syncPage();
        });
      }));
      if (data.feature_image) featureTools.appendChild(button(T.describe, function () {
        core.describe(T, data.feature_alt_he, data.feature_alt_en, function (alts) { data.feature_alt_he = alts.he; data.feature_alt_en = alts.en; changed(); syncPage(); });
      }, "pe-btn pe-describe-btn"));
      if (data.feature_image) featureTools.appendChild(button(T.caption, function () {
        core.captionDialog(T, data, lang, [["hidden", T.capHidden], ["everywhere", T.capShow]], function () { changed(); syncPage(); }, "feature_");
      }, "pe-btn pe-caption-btn"));
      if (data.feature_image) featureTools.appendChild(button(T.removeFeature, function () {
        data.feature_image = ""; data.feature_alt_he = ""; data.feature_alt_en = "";
        changed(); syncPage();
      }, "pe-btn pe-danger"));
    };
    if (!featureBox) {
      featureBox = el("div", { "class": "opening-feature", hidden: "" }, [el("figure", { "class": "jg-item" }, [el("span", { "class": "jg-media" })])]);
      opening.insertBefore(featureBox, opening.querySelector(".opening-tagline"));
    }
    featureBox.classList.add("pe-holder");
    frame(featureBox, {
      start: function () { return featureBox.getBoundingClientRect().width / openingWidth() * 100; },
      area: openingWidth, centred: true, min: phone.matches ? 20 : 15, max: 100,
      live: function (pct) { featureBox.style.maxWidth = pct + "%"; },
      done: function (pct) { if (phone.matches && pct >= 100) delete data[featureKey]; else data[featureKey] = pct; changed(); syncPage(); },
    });
    (data.feature_image ? featureBox : opening).appendChild(featureTools);
    drawFeatureTools();

    var tagline = taglineEl = opening.querySelector(".opening-tagline") || document.querySelector(".tagline");
    if (tagline) {
      tagline.setAttribute("contenteditable", "plaintext-only");
      if (tagline.contentEditable !== "plaintext-only") tagline.setAttribute("contenteditable", "true");
      tagline.classList.add("pe-editable");
      tagline.setAttribute("title", T.taglineHint);
      tagline.addEventListener("input", function () {
        data["tagline_" + lang] = tagline.textContent.replace(/\s+/g, " ").trim();
        refreshStatus();
      });
      tagline.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); tagline.blur(); } });
      // An empty sentence is not kept: the site would show the other language's
      // sentence (or none), and an empty one could not be clicked to write it again.
      var taglineBefore = tagline.textContent.replace(/\s+/g, " ").trim();
      tagline.addEventListener("focus", function () { if (data["tagline_" + lang]) taglineBefore = data["tagline_" + lang]; });
      tagline.addEventListener("blur", function () {
        if (!data["tagline_" + lang]) {
          var back = taglineBefore || JSON.parse(original)["tagline_" + lang];
          if (back) data["tagline_" + lang] = back; else delete data["tagline_" + lang];
          tagline.textContent = back;
          refreshStatus();
          setStatus(T.taglineEmpty, "warn");
        }
        commit();
      });
    }
    // In editing, clicking a picture must not leave the page.
    opening.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a.jg-item") && !e.target.closest(".pe-tools")) e.preventDefault();
    }, true);
  }
  // ---------- posters row: each poster is a project's cover ----------
  var posterEls = {}; // slug -> { el, media, original }
  var posterBox = null, posterOrig = null, posterDrag = "", posterClip = "";
  function setupPosters() {
    posterOrig = document.querySelector(".home-posters [data-mosaic]");
    if (posterOrig) {
      // The editing copy of the row: the same posters, arranged by the editor.
      posterBox = el("div", { "class": posterOrig.className.replace(/\s*is-small/, "") + " pe-poster-box" });
      posterOrig.parentNode.insertBefore(posterBox, posterOrig.nextSibling);
      posterOrig.parentNode.insertBefore(el("p", { "class": "pe-note pe-poster-note", text: touch.matches ? T.posterTouchNote : T.posterSizeNote }), posterBox);
    }
    Array.prototype.forEach.call(document.querySelectorAll(".home-posters [data-project]"), function (item) {
      var slug = item.getAttribute("data-project");
      var p = projects.filter(function (x) { return x.slug === slug; })[0];
      if (!p) return;
      var media = item.querySelector(".jg-media");
      posterEls[slug] = { el: item, media: media, original: media ? media.innerHTML : "" };
      item.classList.add("pe-holder", "pe-poster");
      // The built page's size classes (fs-, fr-, pm-, pb-) carry !important rules
      // that would override the editor's arrangement; the editor lays the posters out itself.
      Array.prototype.slice.call(item.classList).forEach(function (c) { if (/^(fs|fr|pm|pb)-/.test(c)) item.classList.remove(c); });
      // In editing the poster never opens its page; its buttons still work.
      item.addEventListener("click", function (e) { e.preventDefault(); }, true);
      touchPick(item, "poster:" + slug);
      var tools = el("div", { "class": "pe-tools pe-tools-top" });
      item.appendChild(tools);
      posterEls[slug].tools = tools;
      var img = item.querySelector("img");
      posterEls[slug].r = img && Number(img.getAttribute("width")) && Number(img.getAttribute("height")) ? Number(img.getAttribute("width")) / Number(img.getAttribute("height")) : 1.5;
      item.setAttribute("draggable", "true");
      // Phones: the poster's own phone size (poster_w_m), with the same dots.
      if (phone.matches) {
        var pMedia = item.querySelector(".jg-media");
        if (p.poster_w_m >= 20 && pMedia) phoneLine(item, pMedia, p.poster_w_m);
        if (pMedia) frame(item, {
          start: function () { return pMedia.getBoundingClientRect().width / (posterBox.getBoundingClientRect().width || 1) * 100; },
          area: function () { return posterBox.getBoundingClientRect().width; },
          live: function (pct) { phoneLine(item, pMedia, pct); },
          done: function (pct) { p.poster_w_m = pct; changed(); syncPage(); },
          min: 20, max: 100,
        });
      } else frame(item, {
        start: function () { return item.getBoundingClientRect().width / (posterBox.getBoundingClientRect().width || 1) * 100; },
        area: function () { return posterBox.getBoundingClientRect().width; },
        live: function (pct) { core.liveWidth(item, pct); },
        done: function (pct) {
          // The first resize keeps every other poster at its current size.
          if (!postersFree()) {
            var bw = posterBox.getBoundingClientRect().width || 1;
            shownPosters().forEach(function (q) { var n = posterEls[q.slug].el; if (q !== p) q.poster_w = Math.max(10, Math.min(100, Math.round(n.getBoundingClientRect().width / bw * 100))); });
          }
          core.rowWidths(item, posterBox.getBoundingClientRect().width, function (n, w) {
            var q = projects.filter(function (x) { return x.slug === n.getAttribute("data-project"); })[0];
            if (q && q !== p) q.poster_w = w;
          });
          p.poster_w = pct; changed(); syncPage();
        },
        min: 10, max: 100,
      });
      item.addEventListener("dragstart", function (e) {
        if (e.target && e.target.closest && e.target.closest("button, select, input, textarea, label, .pe-dot, .pe-resize")) { e.preventDefault(); return; }
        posterDrag = slug; item.classList.add("is-dragging");
        try { e.dataTransfer.setData("text/plain", slug); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ }
      });
      item.addEventListener("dragend", function () { item.classList.remove("is-dragging"); posterDrag = ""; });
      item.addEventListener("dragover", function (e) { if (posterDrag && posterDrag !== slug) { e.preventDefault(); item.classList.add("is-target"); } });
      item.addEventListener("dragleave", function () { item.classList.remove("is-target"); });
      item.addEventListener("drop", function (e) {
        e.preventDefault(); item.classList.remove("is-target");
        if (!posterDrag || posterDrag === slug) return;
        var list = shownPosters().map(function (q) { return q.slug; });
        var from = list.indexOf(posterDrag);
        var afterTarget = from < list.indexOf(slug); // takes the target's place
        list.splice(from, 1);
        list.splice(list.indexOf(slug) + (afterTarget ? 1 : 0), 0, posterDrag);
        posterDrag = ""; reorderPosters(list); changed(); syncPage();
      });
    });
    // Posters whose project could not be read stay visible as they are (never hidden by editing).
    var missing = posterOrig ? posterOrig.querySelectorAll("[data-project]:not(.pe-poster)").length : 0;
    if (posterOrig && !missing) { posterOrig.hidden = true; posterOrig.style.display = "none"; }
    if (missing) setStatus(T.postersNotLoaded, "warn");
    drawPosters();
  }
  // Posters in the order of the projects (their "order" field).
  function shownPosters() {
    return Object.keys(posterEls).map(function (slug) { return projects.filter(function (x) { return x.slug === slug; })[0]; }).filter(Boolean)
      .sort(function (a, b) { return a.order - b.order; });
  }
  function postersFree() { return shownPosters().some(function (q) { return q.poster_w >= 10; }); }
  // A new order for the posters: the projects get 1, 2, 3… in that order
  // (the other projects keep their places after them).
  function reorderPosters(slugs) {
    var rest = projects.filter(function (q) { return slugs.indexOf(q.slug) < 0; }).sort(function (a, b) { return a.order - b.order; });
    var all = slugs.map(function (sl) { return projects.filter(function (q) { return q.slug === sl; })[0]; }).concat(rest);
    all.forEach(function (q, i) { q.order = i + 1; });
  }
  function movePoster(slug, dir) {
    var list = shownPosters().map(function (q) { return q.slug; }), i = list.indexOf(slug), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    list[i] = list[j]; list[j] = slug;
    reorderPosters(list); changed(); syncPage();
  }
  // Same rows as the built page (src/render.js home()): automatic rows of
  // three (4 → 2+2), or free sizes: rows filled in order, one common height.
  function layoutPosters() {
    if (!posterBox) return;
    var list = shownPosters(), rows = [];
    var free = postersFree() && !phone.matches;
    if (free) {
      var row = [], sum = 0;
      list.forEach(function (q) { var f = q.poster_w || 33; if (row.length && sum + f > 106) { rows.push(row); row = []; sum = 0; } row.push(q); sum += f; });
      if (row.length) rows.push(row);
    } else {
      var i = 0, per = phone.matches ? 2 : 3;
      while (i < list.length) { var left = list.length - i, n = phone.matches ? Math.min(2, left) : left === 4 ? 2 : left <= 3 ? left : 3; rows.push(list.slice(i, i + n)); i += n; }
      void per;
    }
    posterBox.textContent = "";
    rows.forEach(function (rw) {
      var r = el("div", { "class": "mrow n" + rw.length });
      var f = rw.map(function (q) { return q.poster_w || 33; }), total = f.reduce(function (a, b) { return a + b; }, 0);
      var share = f.map(function (x) { return x / total; });
      var h = share.reduce(function (acc, sh, k) { return acc + sh * (sh * 100 / posterEls[rw[k].slug].r); }, 0);
      rw.forEach(function (q, k) {
        var pe = posterEls[q.slug], it = pe.el;
        it.style.removeProperty("flex"); it.style.removeProperty("width"); it.style.minWidth = ""; it.style.marginInline = "";
        if (pe.media) { pe.media.style.aspectRatio = ""; pe.media.style.width = ""; pe.media.style.marginInline = ""; }
        it.style.maxWidth = "";
        // Phones: the poster's own line (poster_w_m), as on the site.
        if (phone.matches && q.poster_w_m >= 20 && pe.media) phoneLine(it, pe.media, q.poster_w_m);
        else if (free && rw.length === 1) {
          // Alone in its row: "important", or the gallery rule (.mrow .jg-item { flex-basis: 0 !important }) shrinks it to nothing.
          // A chosen width decides, also for square and tall posters, as on the site (build.js:
          // the screen-height limit .mrow.n1 > .ar-* is only for pictures without a chosen width).
          var one = Math.min(100, f[0]) + "%";
          it.style.setProperty("flex", "0 0 " + one, "important"); it.style.setProperty("width", one, "important"); it.style.marginInline = "auto";
        }
        else if (free) { it.style.flex = Math.round(share[k] * 1000) + " 1 0"; it.style.minWidth = "0"; if (pe.media) pe.media.style.aspectRatio = String((share[k] * 100) / h); }
        r.appendChild(it);
      });
      posterBox.appendChild(r);
    });
  }
  function drawPosters() {
    Object.keys(posterEls).forEach(function (slug) {
      var pe = posterEls[slug], p = projects.filter(function (x) { return x.slug === slug; })[0];
      if (!p || !pe.media) return;
      // Picture: the new cover chosen here, or the original.
      var want = p.cover ? p.cover.path : "";
      if (pe.shown !== want) {
        if (want) { pe.media.textContent = ""; pe.media.appendChild(picture(want, "40vw")); } else pe.media.innerHTML = pe.original;
        pe.shown = want;
      }
      pe.el.classList.toggle("pe-off", p.in_posters === false);
      pe.tools.textContent = "";
      pe.tools.appendChild(button(T.prevBtn, function () { movePoster(slug, -1); }, "pe-btn pe-move", T.earlier));
      pe.tools.appendChild(el("span", { "class": "pe-tools-label", text: displayName(p) }));
      pe.tools.appendChild(button(T.posterReplace, function () {
        pick(function (path, alts) { p.cover = { path: path, alts: alts }; changed(); syncPage(); }, "", { noProject: true, note: T.posterNote });
      }));
      pe.tools.appendChild(p.in_posters === false
        ? button(T.posterShow, function () { p.in_posters = true; changed(); syncPage(); })
        : button(T.posterHide, function () { p.in_posters = false; changed(); syncPage(); }, "pe-btn pe-danger"));
      if (p.in_posters === false) pe.tools.appendChild(el("span", { "class": "pe-tools-label", text: T.posterHiddenNote }));
      // "Alone in its row" for this poster on this screen size (poster_w on computers, poster_w_m on phones).
      if (p.in_posters !== false) {
        var pk = phone.matches ? "poster_w_m" : "poster_w", pOn = Number(p[pk]) === 100;
        var ab = button(pOn ? T.aloneOff : T.alone, function () {
          if (pOn) { p[pk] = 0; changed(); syncPage(); return; }
          if (pk === "poster_w" && !postersFree()) {
            var bw = posterBox.getBoundingClientRect().width || 1;
            shownPosters().forEach(function (q) { var n = posterEls[q.slug].el; if (q !== p) q.poster_w = Math.max(10, Math.min(100, Math.round(n.getBoundingClientRect().width / bw * 100))); });
          }
          p[pk] = 100; changed(); syncPage();
        }, "pe-btn pe-alone-btn");
        ab.setAttribute("aria-pressed", String(pOn));
        pe.tools.appendChild(ab);
        // Mark to align: marked posters can then all get one poster's width (the bar above the posters).
        pe.tools.appendChild(posterAlign.button(slug));
      }
      posterAlign.mark(pe.el, slug);
      // Cut and paste for posters: the order of the homepage posters.
      Array.prototype.forEach.call(pe.el.querySelectorAll(":scope > .pe-paste-bar"), function (n) { n.remove(); });
      pe.el.classList.toggle("pe-cut", posterClip === slug);
      if (p.in_posters !== false) {
        if (posterClip === slug) pe.tools.appendChild(button(T.cutCancel, function () { posterClip = ""; drawPosters(); }, "pe-btn pe-cut-btn"));
        else if (!posterClip) pe.tools.appendChild(button(T.cut, function () { posterClip = slug; setStatus(T.cutNote); drawPosters(); }, "pe-btn pe-cut-btn"));
        else pe.el.appendChild(el("div", { "class": "pe-paste-bar" }, [button(T.pasteHere, function () {
          var list = shownPosters().map(function (q) { return q.slug; }).filter(function (x) { return x !== posterClip; });
          list.splice(list.indexOf(slug), 0, posterClip); posterClip = "";
          reorderPosters(list); changed(); syncPage();
        }, "pe-btn pe-primary pe-paste-btn")]));
      }
      if (p.poster_w) pe.tools.appendChild(button(T.posterAuto, function () { projects.forEach(function (q) { q.poster_w = 0; }); changed(); syncPage(); }));
      if (!p.cap) p.cap = capOf(null);
      pe.tools.appendChild(button(T.caption, function () {
        core.captionDialog(T, p.cap, lang, [["hidden", T.capHidden], ["everywhere", T.capPoster]], function () { changed(); syncPage(); }, "poster_");
      }, "pe-btn pe-caption-btn"));
      pe.tools.appendChild(button(T.describe, function () {
        core.describe(T, p.cap.cover_alt_he, p.cap.cover_alt_en, function (alts) { p.cap.cover_alt_he = alts.he; p.cap.cover_alt_en = alts.en; changed(); syncPage(); });
      }, "pe-btn pe-describe-btn"));
      Array.prototype.forEach.call(pe.el.querySelectorAll(".pe-missing"), function (n) { n.remove(); });
      if (!p.cap["cover_alt_" + lang]) pe.el.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
      // The caption the page was built with is replaced by the one being edited.
      Array.prototype.forEach.call(pe.el.querySelectorAll(".jg-caption"), function (n) { n.remove(); });
      var pt = p.cap["poster_title_" + lang] || "", pn = p.cap["poster_note_" + lang] || "";
      if (p.cap.poster_caption === "everywhere" && (pt || pn) && pe.media) {
        var pAbove = p.cap.poster_caption_pos === "above", pCap = core.capNode("span", pt, pn, "home", pAbove);
        if (pe.media.parentNode === pe.el) core.placeCap(pCap, pe.media, pAbove);
        else pe.el.insertBefore(pCap, pAbove ? pe.el.firstChild : null);
      }
      pe.tools.appendChild(button(T.nextBtn, function () { movePoster(slug, 1); }, "pe-btn pe-move", T.later));
    });
    // "Paste at the end" under the posters while one is cut.
    var endBar = posterBox && posterBox.parentNode ? posterBox.parentNode.querySelector(".pe-poster-paste-end") : null;
    if (endBar) endBar.remove();
    if (posterClip && posterBox) posterBox.parentNode.insertBefore(el("div", { "class": "pe-add pe-poster-paste-end" }, [button(T.pasteEnd, function () {
      var list = shownPosters().map(function (q) { return q.slug; }).filter(function (x) { return x !== posterClip; });
      list.push(posterClip); posterClip = "";
      reorderPosters(list); changed(); syncPage();
    }, "pe-btn pe-primary pe-paste-btn")]), posterBox.nextSibling);
    // The bar for marked posters, above the posters (js/editor-core.js aligner).
    if (posterBox && posterBox.parentNode) {
      var oldBar = posterBox.parentNode.querySelector('.pe-align-bar[data-align="posters"]');
      if (oldBar) oldBar.remove();
      var pBar = posterAlign.bar();
      if (pBar) posterBox.parentNode.insertBefore(pBar, posterBox);
    }
    layoutPosters();
  }

  // ---------- one width for several marked pictures (js/editor-core.js aligner) ----------
  // Only by hand: nothing changes until "Match the source width" is pressed, and
  // nothing is saved until "Save". The size for the screen being used, like
  // "Alone in its row": posters poster_w / poster_w_m, the gallery fw / fw_m.
  // A poster's width now on this screen size, in % of the row. Computers without
  // free sizes yet: the width it is shown at. Phones: 0 = no own size (two in a row).
  function posterWidthNow(q) {
    if (phone.matches) return Number(q.poster_w_m) >= 20 ? Number(q.poster_w_m) : 0;
    if (Number(q.poster_w) >= 10) return Number(q.poster_w);
    var bw = posterBox ? posterBox.getBoundingClientRect().width || 1 : 1;
    return Math.max(10, Math.min(100, Math.round(posterEls[q.slug].el.getBoundingClientRect().width / bw * 100)));
  }
  var posterAlign = core.aligner({
    id: "posters", lang: lang, noun: "posters",
    phone: function () { return phone.matches; },
    items: function () { return shownPosters().filter(function (q) { return q.in_posters !== false; }).map(function (q) { return { key: q.slug, name: displayName(q) }; }); },
    width: function (slug) { var q = projects.filter(function (x) { return x.slug === slug; })[0]; return q ? posterWidthNow(q) : 0; },
    apply: function (slugs, w) {
      var pk = phone.matches ? "poster_w_m" : "poster_w";
      // Computers, first free size: every other poster keeps the width it is shown at (as a first resize does).
      if (pk === "poster_w" && !postersFree()) shownPosters().forEach(function (q) { q.poster_w = posterWidthNow(q); });
      shownPosters().forEach(function (q) { if (slugs.indexOf(q.slug) >= 0) q[pk] = w; });
      changed(); syncPage();
    },
    redraw: function () { drawPosters(); },
    status: function (msg, same) { if (same) setStatus(msg); else setStatus(msg + " · " + T.unsaved, "warn"); },
    pairs: true,
  });
  // The homepage gallery (under the posters): the pictures shown now, kept by render().
  var galShown = [];
  function galFig(g) { return editArea.querySelector('.pe-mosaic .pe-item[data-idx="' + data.gallery.indexOf(g) + '"]'); }
  function galWidthNow(g) {
    if (phone.matches) return Number(g.fw_m) >= 20 ? Number(g.fw_m) : 0;
    if (Number(g.fw) >= 10) return Number(g.fw);
    var n = galFig(g), aw = editArea.getBoundingClientRect().width || 1;
    return n ? Math.max(10, Math.min(100, Math.round(n.getBoundingClientRect().width / aw * 100))) : 33;
  }
  function galName(g) {
    var o = lang === "he" ? "en" : "he";
    return g["title_" + lang] || g["alt_" + lang] || g["title_" + o] || g["alt_" + o] || String(g.image || "").split("/").pop();
  }
  var galAlign = core.aligner({
    id: "gallery", lang: lang, noun: "pictures",
    phone: function () { return phone.matches; },
    items: function () { return galShown.map(function (it) { return { key: it.g, name: galName(it.g) }; }); },
    width: galWidthNow,
    apply: function (list, w) {
      var key = phone.matches ? "fw_m" : "fw";
      // Computers, first free size: the other pictures keep the size they look now (as a first resize does).
      if (key === "fw" && !isFree()) startFree();
      list.forEach(function (g) { if (w) g[key] = w; else delete g[key]; });
      changed();
    },
    redraw: function () { render(); },
    status: function (msg, same) { if (same) setStatus(msg); else setStatus(msg + " · " + T.unsaved, "warn"); },
    pairs: true,
  });

  // Brings the opening and the toolbar in line with the state (after undo
  // or after loading an earlier version).
  // The gallery picture that is also the opening picture (the site shows its title and text).
  function heroInGallery() {
    var h = norm(data.hero_image);
    if (!h || !Array.isArray(data.gallery)) return null;
    for (var i = 0; i < data.gallery.length; i++) { var g = data.gallery[i]; if (g && g.visible !== false && norm(g.image) === h) return g; }
    return null;
  }
  // The title and text under an opening picture, as visitors will see them.
  function showCap(box, o, pre) {
    if (!box) return;
    // The caption the page was built with is replaced by the one being edited.
    Array.prototype.forEach.call(box.querySelectorAll(".jg-caption"), function (n) { n.remove(); });
    var t1 = o[pre + "title_" + lang] || "", t2 = o[pre + "note_" + lang] || "";
    if (o[pre + "caption"] !== "everywhere" || !(t1 || t2)) return;
    var above = o[pre + "caption_pos"] === "above";
    var fig = box.querySelector(".jg-item") || box.querySelector("figure") || box;
    var media = fig.querySelector(".jg-media");
    var node = core.capNode(fig.tagName === "A" ? "span" : "figcaption", t1, t2, "home", above);
    if (media && media.parentNode === fig) core.placeCap(node, media, above);
    else fig.appendChild(node);
  }
  function syncPage() {
    // The sizes for this screen: phone sizes on a phone, computer sizes on a computer.
    var hw = phone.matches ? data.hero_w_m : data.hero_w, fw = phone.matches ? data.feature_w_m : data.feature_w;
    if (heroBox) { heroBox.style.maxWidth = hw ? hw + "%" : ""; heroBox.style.marginInline = hw ? "auto" : ""; }
    if (featureBox) { featureBox.style.maxWidth = fw ? fw + "%" : ""; if (phone.matches) featureBox.style.marginInline = fw ? "auto" : ""; }
    if (featureBox) ["medium", "large", "full"].forEach(function (k) { featureBox.classList.toggle("feature-" + k, data.feature_size === k); });
    drawPosters();
    if (layoutSelects.cols) layoutSelects.cols.value = data.gallery_columns || "mixed";
    if (layoutSelects.phone) layoutSelects.phone.value = data.gallery_phone || "mixed";
    if (layoutSelects.gap) layoutSelects.gap.value = data.gallery_gap || "minimal";
    if (heroBox && norm(data.hero_image) && norm(data.hero_image) !== shownHero) { swapImg(heroBox, data.hero_image); shownHero = norm(data.hero_image); }
    if (featureBox) {
      featureBox.hidden = !data.feature_image;
      if (data.feature_image && norm(data.feature_image) !== shownFeature) { swapImg(featureBox, data.feature_image); }
      shownFeature = norm(data.feature_image);
      if (featureTools) (data.feature_image ? featureBox : opening).appendChild(featureTools);
      drawFeatureTools();
    }
    var hg = heroInGallery();
    showCap(heroBox, hg || data, hg ? "" : "hero_");
    if (data.feature_image) showCap(featureBox, data, "feature_");
    if (taglineEl && document.activeElement !== taglineEl) {
      var tl = data["tagline_" + lang];
      if (tl) taglineEl.textContent = tl;
    }
  }
  function swapImg(box, path) {
    var media = box.querySelector(".jg-media");
    if (!media) return;
    media.textContent = "";
    media.style.aspectRatio = "";
    media.appendChild(picture(path, "100vw"));
  }

  // ---------- gallery ----------
  // The same rows as the built page (src/render.js, home()).
  function buildRows(list, counts, minSum, maxPer, sized, firstAlone) {
    var out = [], i = 0, k = 0;
    if (firstAlone && list.length) { out.push([0]); i = 1; }
    while (i < list.length) {
      var size = list[i].g.size;
      var count = sized && size === "large" ? 1 : sized && size === "medium" ? 2 : sized && size === "small" ? 4 : counts[k++ % counts.length];
      if (count === 1 && list[i].r < 1.3 && !(sized && size === "large")) count = 2;
      count = Math.min(count, maxPer);
      var row = [], sum = 0;
      var chosen = sized && ["large", "medium", "small"].indexOf(size) >= 0;
      // A picture with its own chosen size starts its own row.
      var ownSize = function (n) { return sized && ["large", "medium", "small"].indexOf(list[n].g.size) >= 0; };
      while (i < list.length && (row.length < count || (!chosen && count > 1 && sum < minSum && row.length < maxPer)) && !(row.length && ownSize(i) && (!chosen || list[i].g.size !== size))) {
        row.push(i); sum += list[i].r; i++;
      }
      out.push(row);
    }
    return out;
  }
  var phone = window.matchMedia("(max-width: 700px)");
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
  if (phone.addEventListener) phone.addEventListener("change", function () { if (data) { render(); layoutPosters(); } });

  // ---------- free sizes (computers): width in % of the page ----------
  function isFree() { return data.gallery.some(function (g) { return g && g.visible !== false && Number(g.fw) >= 10; }); }
  // Turning free sizes on keeps the picture sizes as they look now.
  function startFree() {
    var area = editArea.getBoundingClientRect().width || 1;
    Array.prototype.forEach.call(editArea.querySelectorAll(".pe-mosaic .pe-item"), function (fig) {
      var g = data.gallery[Number(fig.getAttribute("data-idx"))];
      if (g) g.fw = Math.max(10, Math.min(100, Math.round(fig.getBoundingClientRect().width / area * 100)));
    });
  }
  // Same rows as the built page (src/render.js): filled in order; pictures
  // sharing a row fill it exactly with one common height.
  function freeRows(list) {
    var out = [], row = [], sum = 0;
    list.forEach(function (it, n) {
      var f = Number(it.g.fw) || 33;
      if (row.length && sum + f > 106) { out.push(row); row = []; sum = 0; }
      row.push(n); sum += f;
    });
    if (row.length) out.push(row);
    return out;
  }
  function applyFree(list, row) {
    var f = row.map(function (n) { return Number(list[n].g.fw) || 33; });
    if (row.length === 1) { list[row[0]].free = { single: Math.min(100, f[0]) }; return; }
    var total = f.reduce(function (a, b) { return a + b; }, 0);
    var share = f.map(function (x) { return x / total; });
    var h = share.reduce(function (acc, sh, k) { return acc + sh * (sh * 100 / list[row[k]].r); }, 0);
    row.forEach(function (n, k) { list[n].free = { grow: Math.round(share[k] * 1000), ar: (share[k] * 100) / h }; });
  }

  var dragFrom = -1, selected = -1;
  function render() {
    if (!data) return;
    editArea.textContent = "";
    var heroP = norm(data.hero_image), featureP = norm(data.feature_image);
    var seen = {}, shown = [], hidden = [], elsewhere = [];
    data.gallery.forEach(function (g, idx) {
      if (!g) return;
      var p = norm(g.image);
      if (g.visible === false) { hidden.push(idx); return; }
      if (!p || seen[p] || p === heroP || p === featureP || posterSrcs[p]) { elsewhere.push(idx); return; }
      seen[p] = true;
      shown.push({ g: g, idx: idx, r: ratioOf(g) });
    });
    galShown = shown; // the pictures that can be marked to align (galAlign)

    var cols = Number(data.gallery_columns) || 0, ph = Number(data.gallery_phone) || 0;
    var freeOn = isFree() && !phone.matches;
    shown.forEach(function (it) { it.free = null; });
    var rows = freeOn ? freeRows(shown) : phone.matches
      ? (ph ? buildRows(shown, [ph], 1.4, ph, false, !heroP) : buildRows(shown, [2, 1, 2, 2], 1.4, 2, false, !heroP))
      : (cols ? buildRows(shown, [cols], 2.3, cols, true, !heroP) : buildRows(shown, [2, 3, 1, 3, 2, 4], 2.3, 5, true, !heroP));

    var gapCls = ["none", "small", "medium"].indexOf(data.gallery_gap) >= 0 ? " gap-" + data.gallery_gap : "";
    var box = el("div", { "class": "mosaic pe-mosaic" + gapCls });
    if (freeOn) rows.forEach(function (row) { applyFree(shown, row); });
    if (layoutSelects.cols) layoutSelects.cols.value = isFree() ? "free" : (data.gallery_columns || "mixed");
    rows.forEach(function (row) {
      var r = el("div", { "class": "mrow n" + row.length });
      row.forEach(function (n) { shown[n].alone = row.length === 1; r.appendChild(cell(shown[n])); });
      box.appendChild(r);
    });
    editArea.appendChild(box);
    // The bar for marked gallery pictures, above the gallery (once it is on the page: the widths shown are measured on it).
    var gBar = galAlign.bar();
    if (gBar) editArea.insertBefore(gBar, box);
    if (clip) editArea.appendChild(el("div", { "class": "pe-add" }, [button(T.pasteEnd, function () { pasteAt(null); }, "pe-btn pe-primary pe-paste-btn")]));
    editArea.appendChild(el("div", { "class": "pe-add" }, [button("+ " + T.add, function () {
      pick(function (paths, alts, choice) {
        paths.forEach(function (path) {
          addToPage(choice.toPage && choice.project, path, alts);
          data.gallery.push({ image: "/" + path, visible: true, size: "auto", link: "", project: choice.project || "", alt_en: alts.en, alt_he: alts.he, title_en: "", title_he: "", note_en: "", note_he: "", caption: "hidden", frame: "natural", focus: "center" });
        });
        changed();
      }, "", { many: true });
    }, "pe-btn pe-primary")]));
    if (hidden.length) editArea.appendChild(strip(T.hiddenTitle, hidden, true));
    var hiddenPosters = projects.filter(function (p) { return !p.isNew && p.in_posters === false && !posterEls[p.slug]; });
    if (hiddenPosters.length) {
      var hp = el("div", { "class": "pe-strip" }, [el("p", { "class": "pe-strip-title", text: T.postersHiddenTitle })]);
      var hpRow = el("div", { "class": "pe-strip-row" });
      hiddenPosters.forEach(function (p) {
        hpRow.appendChild(el("figure", { "class": "pe-thumb" }, [
          picture(p.cover ? p.cover.path : p.origCover, "160px"),
          el("figcaption", { "class": "pe-note", text: displayName(p) }),
          el("div", { "class": "pe-tools" }, [button(T.posterShow, function () { p.in_posters = true; changed(); })]),
        ]));
      });
      hp.appendChild(hpRow);
      editArea.appendChild(hp);
    }
    if (elsewhere.length) editArea.appendChild(strip(T.elsewhereTitle, elsewhere, false));
  }

  // A picture with its own phone size: its own line, that wide, centred (as on the site).
  function phoneLine(fig, media, pct) {
    fig.style.setProperty("flex", "1 1 100%", "important"); fig.style.setProperty("width", "100%", "important"); fig.style.maxWidth = "none"; // as the site's pm-W rule (beats .mrow .jg-item)
    media.style.width = pct + "%"; media.style.marginInline = "auto";
  }
  function cell(item) {
    var g = item.g, idx = item.idx;
    var media = el("span", { "class": "jg-media" }, [picture(g.image, "30vw", render)]);
    media.style.aspectRatio = String(item.r);
    var fig = el("figure", { "class": "jg-item pe-item" + (FRAMES[g.frame] ? " fit-cover focus-" + (g.focus || "center") : ""), draggable: "true", "data-idx": String(idx), title: T.drag }, [media]);
    fig.style.flexGrow = String(Math.round(item.r * 100));
    if (item.free && item.free.single) { fig.classList.add("pe-alone"); fig.style.width = item.free.single + "%"; }
    else if (item.free) { fig.classList.add("pe-free"); fig.style.flexGrow = String(item.free.grow); fig.style.minWidth = "0"; media.style.aspectRatio = String(item.free.ar); media.classList.add("pe-crop"); }
    else if (item.alone && item.r < 1.3) { fig.classList.add("pe-alone"); fig.style.width = "min(100%, calc(80vh * " + item.r + "))"; }
    if (uploads[norm(g.image)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
    // Phones: the picture's own phone size (fw_m), with the same dots; computers keep fw.
    if (phone.matches) {
      if (Number(g.fw_m) >= 20) phoneLine(fig, media, Number(g.fw_m));
      frame(fig, {
        start: function () { return media.getBoundingClientRect().width / (editArea.getBoundingClientRect().width || 1) * 100; },
        live: function (pct) { phoneLine(fig, media, pct); },
        done: function (pct) { g.fw_m = pct; selected = idx; changed(); },
        min: 20, max: 100, selectedNow: selected === idx,
      });
    } else frame(fig, {
      start: function () { return fig.getBoundingClientRect().width / (editArea.getBoundingClientRect().width || 1) * 100; },
      live: function (pct) { core.liveWidth(fig, pct); },
      done: function (pct) {
        if (!isFree()) startFree();
        core.rowWidths(fig, editArea.getBoundingClientRect().width, function (n, w) { var o = data.gallery[Number(n.getAttribute("data-idx"))]; if (o && o !== g) o.fw = w; });
        g.fw = pct;
        var gal = function (n) { return data.gallery[Number(n.getAttribute("data-idx"))]; };
        core.fillRow(editArea.querySelectorAll(".pe-mosaic .pe-item"), fig, function (n) { var o = gal(n); return o && o.fw; }, function (n, w) { var o = gal(n); if (o) o.fw = w; });
        selected = idx; changed();
      },
      min: 10, max: 100, selectedNow: selected === idx,
    });
    touchPick(fig, g);
    galAlign.mark(fig, g);
    // Arrows follow the reading direction: "earlier" points right in Hebrew.
    fig.appendChild(el("div", { "class": "pe-tools" }, [
      button(T.prevBtn, function () { move(idx, -1); }, "pe-btn pe-move", T.earlier),
      select(T.frame, g.frame || "natural", [["natural", T.frame + ": " + T.frameNatural], ["wide", T.frame + ": " + T.frameWide], ["landscape", T.frame + ": " + T.frameLandscape], ["square", T.frame + ": " + T.frameSquare], ["portrait", T.frame + ": " + T.framePortrait]],
        function (v) { g.frame = v; changed(); }),
      projectSelect(g.project || "", function (v) { g.project = v; changed(); }),
      button(T.replace, function () {
        pick(function (path, alts, choice) {
          addToPage(choice.toPage && choice.project, path, alts);
          g.image = "/" + path; g.alt_he = alts.he; g.alt_en = alts.en;
          if (choice.project !== undefined) g.project = choice.project;
          changed();
        }, g.project || "");
      }),
      aloneButton(g, idx),
      galAlign.button(g),
      clip === g ? button(T.cutCancel, function () { clip = null; render(); }, "pe-btn pe-cut-btn")
        : clip ? null : button(T.cut, function () { clip = g; setStatus(T.cutNote); render(); }, "pe-btn pe-cut-btn"),
      button(T.hide, function () { g.visible = false; changed(); }),
      button(T.remove, function () { data.gallery.splice(data.gallery.indexOf(g), 1); changed(); }, "pe-btn pe-danger"),
      button(T.describe, function () {
        core.describe(T, g.alt_he, g.alt_en, function (alts) { g.alt_he = alts.he; g.alt_en = alts.en; changed(); });
      }, "pe-btn pe-describe-btn"),
      button(T.caption, function () {
        core.captionDialog(T, g, lang, [["hidden", T.capHidden], ["everywhere", T.capHome]], changed);
      }, "pe-btn pe-caption-btn"),
      button(T.nextBtn, function () { move(idx, 1); }, "pe-btn pe-move", T.later),
    ]));
    if (!g["alt_" + lang]) fig.appendChild(el("span", { "class": "pe-missing", text: T.noAlt }));
    if (clip === g) fig.classList.add("pe-cut");
    else if (clip) fig.appendChild(el("div", { "class": "pe-paste-bar" }, [button(T.pasteHere, function () { pasteAt(g); }, "pe-btn pe-primary pe-paste-btn")]));
    // The title and text as visitors will see them (only when chosen to be shown).
    var capTitle = g["title_" + lang] || "", capNote = g["note_" + lang] || "";
    if (g.caption === "everywhere" && (capTitle || capNote)) core.placeCap(core.capNode("figcaption", capTitle, capNote, "home", g.caption_pos === "above"), media, g.caption_pos === "above");
    fig.addEventListener("dragstart", function (e) { if (e.target && e.target.closest && e.target.closest("button, select, input, textarea, label, .pe-dot, .pe-resize")) { e.preventDefault(); return; } dragFrom = idx; fig.classList.add("is-dragging"); try { e.dataTransfer.setData("text/plain", String(idx)); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ } });
    fig.addEventListener("dragend", function () { fig.classList.remove("is-dragging"); dragFrom = -1; });
    fig.addEventListener("dragover", function (e) { if (dragFrom >= 0 && dragFrom !== idx) { e.preventDefault(); fig.classList.add("is-target"); } });
    fig.addEventListener("dragleave", function () { fig.classList.remove("is-target"); });
    fig.addEventListener("drop", function (e) {
      e.preventDefault(); fig.classList.remove("is-target");
      if (dragFrom < 0 || dragFrom === idx) return;
      var afterTarget = dragFrom < data.gallery.indexOf(g); // takes the target's place
      var moved = data.gallery.splice(dragFrom, 1)[0];
      var to = data.gallery.indexOf(g) + (afterTarget ? 1 : 0);
      data.gallery.splice(to, 0, moved);
      dragFrom = -1; changed();
    });
    fig.setAttribute("aria-label", g["alt_" + lang] || g.image);
    return fig;
  }
  // Moves a picture one place among the pictures shown in the gallery
  // (hidden pictures and pictures shown elsewhere keep their places).
  function move(idx, dir) {
    var heroP = norm(data.hero_image), featureP = norm(data.feature_image), seen = {}, visibleIdx = [];
    data.gallery.forEach(function (g, i) {
      var p = norm(g && g.image);
      if (!g || g.visible === false || !p || seen[p] || p === heroP || p === featureP || posterSrcs[p]) return;
      seen[p] = true; visibleIdx.push(i);
    });
    var at = visibleIdx.indexOf(idx), other = visibleIdx[at + dir];
    if (at < 0 || other === undefined) return;
    var tmp = data.gallery[idx];
    data.gallery[idx] = data.gallery[other];
    data.gallery[other] = tmp;
    changed();
  }
  // Cut and paste: a picture moves to another place in the gallery.
  var clip = null;
  function pasteAt(before) {
    if (!clip) return;
    var g = clip; clip = null;
    var k = data.gallery.indexOf(g); if (k < 0) { render(); return; } // the gallery changed (undo)
    data.gallery.splice(k, 1);
    var at = before ? data.gallery.indexOf(before) : -1;
    if (at < 0) data.gallery.push(g); else data.gallery.splice(at, 0, g);
    changed();
  }
  // "Alone in its row": the whole row on this screen size (fw on computers, fw_m on phones).
  function aloneButton(g, idx) {
    var key = phone.matches ? "fw_m" : "fw", on = Number(g[key]) === 100;
    var b = button(on ? T.aloneOff : T.alone, function () {
      if (on) { delete g[key]; changed(); return; }
      if (key === "fw" && !isFree()) startFree();
      g[key] = 100; selected = idx; changed();
    }, "pe-btn pe-alone-btn");
    b.setAttribute("aria-pressed", String(on));
    return b;
  }
  // Size: three clear buttons (and "automatic"), plus a handle to drag.
  function sizeButtons(g) {
    var box = el("div", { "class": "pe-sizes", role: "group", "aria-label": T.size });
    [["small", T.sizeSmall], ["medium", T.sizeMedium], ["large", T.sizeLarge], ["auto", T.sizeAuto]].forEach(function (o) {
      var b = button(o[1], function () {
        if (isFree()) { if (o[0] === "auto") delete g.fw; else g.fw = { small: 25, medium: 50, large: 100 }[o[0]]; }
        else g.size = o[0];
        changed();
      }, "pe-btn pe-size", T.size + ": " + o[1]);
      b.setAttribute("aria-pressed", String(isFree() ? (o[0] === "small" && g.fw == 25) || (o[0] === "medium" && g.fw == 50) || (o[0] === "large" && g.fw == 100) : (g.size || "auto") === o[0]));
      box.appendChild(b);
    });
    return box;
  }
  // ---------- selection frame: click a picture, drag a dot to resize ----------
  // Dots on the four corners and the two sides. Dragging away from the
  // picture makes it bigger, towards it smaller; the width is shown in %.
  var frameOf = null;
  function deselectAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".pe-selected"), function (n) { n.classList.remove("pe-selected"); });
  }
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
        var area = (o.area ? o.area() : editArea.getBoundingClientRect().width) || 1;
        // Physical side of the dot (left/right on the screen).
        var r = dot.getBoundingClientRect(), b = box.getBoundingClientRect();
        var right = r.left + r.width / 2 > b.left + b.width / 2, bottom = pos.charAt(0) === "s";
        var pct = Math.round(startPct);
        box.classList.add("is-resizing", "pe-selected");
        try { dot.setPointerCapture(e.pointerId); } catch (x) { /* old browser */ }
        function move(ev) {
          var dx = (ev.clientX - startX) * (right ? 1 : -1);
          // Centred pictures grow on both sides, so a side drag counts twice.
          if (o.centred) dx *= 2;
          var dy = pos.length === 2 ? (ev.clientY - startY) * (bottom ? 1 : -1) * (b.width / Math.max(1, b.height)) : 0;
          var d = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
          pct = Math.max(o.min, Math.min(o.max, Math.round(startPct + d / area * 100)));
          label.textContent = T.widthLabel + " " + pct + "%";
          o.live(pct);
        }
        function up() {
          dot.removeEventListener("pointermove", move); dot.removeEventListener("pointerup", up); dot.removeEventListener("pointercancel", up);
          box.classList.remove("is-resizing"); box.setAttribute("draggable", "true");
          if (pct !== Math.round(startPct)) o.done(pct);
          setTimeout(function () { label.textContent = ""; }, 900);
        }
        dot.addEventListener("pointermove", move); dot.addEventListener("pointerup", up); dot.addEventListener("pointercancel", up);
      });
      box.appendChild(dot);
    });
  }
  function strip(title, list, canShow) {
    var wrap = el("div", { "class": "pe-strip" }, [el("p", { "class": "pe-strip-title", text: title })]);
    var row = el("div", { "class": "pe-strip-row" });
    list.forEach(function (idx) {
      var g = data.gallery[idx];
      var tools = [];
      if (canShow) {
        tools.push(button(T.show, function () { g.visible = true; changed(); }));
        tools.push(button(T.remove, function () { data.gallery.splice(data.gallery.indexOf(g), 1); changed(); }, "pe-btn pe-danger"));
      }
      row.appendChild(el("figure", { "class": "pe-thumb" }, [picture(g.image, "160px"), el("div", { "class": "pe-tools" }, tools)]));
    });
    wrap.appendChild(row);
    return wrap;
  }

  // ---------- picture chooser ----------
  var imageList = null;
  function listImages() {
    if (imageList) return Promise.resolve(imageList);
    // Pictures in assets/work and assets/uploads, including one level of
    // project folders inside assets/uploads (only folders that exist).
    var get = function (d) { return api("/contents/" + encPath(d) + "?ref=" + encodeURIComponent(BRANCH)).catch(function () { return []; }); };
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
  // Choosing pictures. opts.many: several at once (tap to select or unselect,
  // or upload several files); done then gets a list of paths, once.
  function pick(done, currentProject, opts) {
    opts = opts || {};
    var chosen = [];
    var proj = projectSelect(currentProject || "", function () { toPage.disabled = !proj.value; if (!proj.value) toPage.checked = false; });
    proj.classList.add("pe-input");
    var toPage = el("input", { type: "checkbox" });
    toPage.disabled = !proj.value;
    var grid = el("div", { "class": "pe-pick-grid" }, [el("p", { text: T.pickLoading })]);
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input" });
    var chooseBtn = button(T.choose, function () {
      if (!chosen.length) return;
      close();
      // A picture uploaded now is stored in the chosen project's folder.
      var paths = chosen.map(function (c) {
        if (uploads[c] && !uploads[c].done && proj.value && c.indexOf("assets/uploads/" + proj.value + "/") !== 0) {
          var moved = c.replace(/^assets\/uploads\//, "assets/uploads/" + proj.value + "/");
          uploads[moved] = uploads[c]; delete uploads[c];
          if (imageList) imageList = imageList.map(function (p) { return p === c ? moved : p; });
          return moved;
        }
        return c;
      });
      // A description written here belongs to one picture only.
      var alts = paths.length === 1 ? { he: altHe.value.trim(), en: altEn.value.trim() } : { he: "", en: "" };
      var choice = { project: proj.value, toPage: toPage.checked };
      if (opts.many) done(paths, alts, choice); else done(paths[0], alts, choice);
    }, "pe-btn pe-primary");
    chooseBtn.disabled = true;
    var altBox = el("div", { "class": "pe-alt-box" }, [
      el("p", { "class": "pe-note", text: T.altNote }),
      el("label", {}, [document.createTextNode(T.altHe), altHe]),
      el("label", {}, [document.createTextNode(T.altEn), altEn]),
    ]);
    var file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "class": "pe-file" });
    if (opts.many) file.multiple = true;
    file.addEventListener("change", function () {
      var raw = Array.prototype.slice.call(file.files || []);
      if (!raw.length) return;
      // Web-sized first (BubaCore.shrinkImage: as in the admin panel), then added like any picture.
      core.shrinkImages(raw).then(function (list) {
      var stamp = Date.now().toString(36);
      list.forEach(function (f, k) {
        var safe = f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "picture";
        var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
        var path = "assets/uploads/" + safe + "-" + stamp + (list.length > 1 ? "-" + (k + 1) : "") + ext;
        uploads[path] = { file: f, blobUrl: URL.createObjectURL(f) };
        if (imageList) imageList.unshift(path);
        if (opts.many) { if (chosen.indexOf(path) < 0) chosen.push(path); } else chosen = [path];
      });
      update();
      draw();
      });
    });
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.pickTitle }, [
      el("div", { "class": "pe-modal-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.pickTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("label", { "class": "pe-upload" }, [document.createTextNode(T.pickUpload + " "), file]),
        opts.many ? el("p", { "class": "pe-note pe-pick-many", text: T.pickMany }) : null,
        grid,
        el("div", { "class": "pe-modal-foot" }, [
          opts.note ? el("p", { "class": "pe-note", text: opts.note }) : null,
          altBox,
          opts.many ? el("p", { "class": "pe-note pe-many-alt", text: T.manyAlt }) : null,
          opts.noProject ? null : el("label", {}, [document.createTextNode(T.pickProject), proj]),
          opts.noProject ? null : el("label", { "class": "pe-check" }, [toPage, document.createTextNode(" " + T.toPage)]),
          chooseBtn,
        ]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    function update() {
      chooseBtn.disabled = !chosen.length;
      chooseBtn.textContent = opts.many && chosen.length > 1 ? T.choose + " (" + chosen.length + ")" : T.choose;
      altBox.hidden = chosen.length > 1;
      Array.prototype.forEach.call(grid.querySelectorAll("button[data-path]"), function (b) { b.setAttribute("aria-pressed", String(chosen.indexOf(b.getAttribute("data-path")) >= 0)); });
    }
    function choose(path) {
      if (!opts.many) chosen = [path];
      else if (chosen.indexOf(path) >= 0) chosen.splice(chosen.indexOf(path), 1);
      else chosen.push(path);
      update();
    }
    function draw() {
      grid.textContent = "";
      (imageList || []).forEach(function (p) {
        var b = el("button", { type: "button", "class": "pe-pick", "data-path": p, "aria-pressed": String(chosen.indexOf(p) >= 0), title: p.split("/").pop(), "aria-label": p.split("/").pop() }, [picture(p, "160px")]);
        b.addEventListener("click", function () { choose(p); });
        if (!opts.many) b.addEventListener("dblclick", function () { choose(p); chooseBtn.click(); });
        grid.appendChild(b);
      });
    }
    document.body.appendChild(dialog);
    listImages().then(draw);
  }

  // ---------- projects: names and new projects ----------
  function slugify(str) { return String(str || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
  function projectsPanel() {
    var list = el("div", { "class": "pe-proj-list" });
    function drawList() {
      list.textContent = "";
      projects.forEach(function (p) {
        var inHe = el("input", { type: "text", dir: "rtl", "class": "pe-input", value: p.title_he });
        var inEn = el("input", { type: "text", dir: "ltr", "class": "pe-input", value: p.title_en });
        inHe.addEventListener("input", function () { p.title_he = inHe.value.trim(); refreshStatus(); });
        inEn.addEventListener("input", function () { p.title_en = inEn.value.trim(); refreshStatus(); });
        var link = p.isNew ? el("span", { "class": "pe-note", text: T.newMark }) : el("a", { href: "work/" + p.slug + "/" + (location.pathname.slice(-10) === "index.html" ? "index.html" : ""), target: "_blank", rel: "noopener", text: T.open });
        list.appendChild(el("div", { "class": "pe-proj-row" }, [
          el("label", {}, [document.createTextNode(T.nameHe), inHe]),
          el("label", {}, [document.createTextNode(T.nameEn), inEn]),
          el("div", { "class": "pe-proj-meta" }, [el("span", { "class": "pe-note", text: T.address + ": " + p.slug }), link]),
        ]));
      });
    }
    var nHe = el("input", { type: "text", dir: "rtl", "class": "pe-input" });
    var nEn = el("input", { type: "text", dir: "ltr", "class": "pe-input" });
    var nSlug = el("input", { type: "text", dir: "ltr", "class": "pe-input", placeholder: "my-new-project" });
    var slugTouched = false;
    nEn.addEventListener("input", function () { if (!slugTouched) nSlug.value = slugify(nEn.value); });
    nSlug.addEventListener("input", function () { slugTouched = true; });
    var cover = null;
    var coverInfo = el("span", { "class": "pe-note" });
    var msg = el("p", { "class": "pe-note", role: "status" });
    var form = el("div", { "class": "pe-proj-new" }, [
      el("strong", { text: T.newProject }),
      el("label", {}, [document.createTextNode(T.nameHe), nHe]),
      el("label", {}, [document.createTextNode(T.nameEn), nEn]),
      el("label", {}, [document.createTextNode(T.address), nSlug, el("span", { "class": "pe-note", text: T.addressHint })]),
      el("div", { "class": "pe-proj-meta" }, [button(T.chooseCover, function () {
        pick(function (path, alts) { cover = { path: path, alts: alts }; coverInfo.textContent = path.split("/").pop(); }, "", { noProject: true });
      }), coverInfo]),
      el("p", { "class": "pe-note", text: T.noImageNote }),
      msg,
      button(T.create, function () {
        var slug = nSlug.value.trim();
        if (!nHe.value.trim() && !nEn.value.trim()) { msg.textContent = T.errName; return; }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) { msg.textContent = T.errAddress; return; }
        if (projects.some(function (p) { return p.slug === slug; })) { msg.textContent = T.errTaken; return; }
        var maxOrder = projects.reduce(function (m, p) { return Math.max(m, p.order || 0); }, 0);
        projects.push({ slug: slug, isNew: true, title_he: nHe.value.trim(), title_en: nEn.value.trim(), orig_he: "", orig_en: "", order: maxOrder + 1, cover: cover, cap: capOf(cover ? { cover_alt_he: cover.alts.he || "", cover_alt_en: cover.alts.en || "" } : null), origCap: JSON.stringify(capOf(null)) });
        nHe.value = ""; nEn.value = ""; nSlug.value = ""; slugTouched = false; cover = null; coverInfo.textContent = "";
        msg.textContent = T.created;
        drawList(); commit(); refreshStatus(); render();
      }, "pe-btn pe-primary"),
    ]);
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.projectsTitle }, [
      el("div", { "class": "pe-modal-box pe-proj-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.projectsTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("div", { "class": "pe-proj-scroll" }, [list, form]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); commit(); render(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    drawList();
    document.body.appendChild(dialog);
  }
  // ---------- earlier versions (like "site history" in website builders) ----------
  function historyPanel() {
    core.history(launcher, {
      api: api, path: FILE, branch: BRANCH, title: T.historyTitle, note: T.historyNote,
      load: function (commitSha) {
        return api("/contents/" + encPath(FILE) + "?ref=" + encodeURIComponent(commitSha)).then(function (res) {
          var old = JSON.parse(b64ToUtf8(res.content));
          if (!old || typeof old !== "object" || Array.isArray(old)) throw new Error("bad file");
          if (!Array.isArray(old.gallery)) old.gallery = [];
          data = old;
          changed(); syncPage();
        });
      },
      onLoaded: function () { setStatus(T.historyLoaded, "warn"); },
      onError: function () { setStatus(T.errLoad, "error"); },
      onMissing: function () { setStatus(T.errLoad, "error"); },
    });
  }

  // ---------- first-time tips ----------
  var TIP = "bubapix-editor-tip";
  function showTip(force) {
    var seen = false;
    try { seen = localStorage.getItem(TIP) === "1"; } catch (e) { seen = false; }
    if (seen && !force) return;
    var old = document.querySelector(".pe-tip");
    if (old) old.remove();
    var box = el("div", { "class": "pe-tip", role: "note" }, [
      el("strong", { text: T.tipTitle }),
      el("ol", {}, (touch.matches ? [T.tipTouch, T.tip2, T.tip3, T.tip4] : [T.tip1, T.tip2, T.tip3, T.tip4]).map(function (t) { return el("li", { text: t }); })),
      button(T.tipClose, function () { try { localStorage.setItem(TIP, "1"); } catch (e) { /* storage blocked */ } box.remove(); }, "pe-btn pe-primary"),
    ]);
    bar.parentNode.insertBefore(box, bar.nextSibling);
  }

  // ---------- after saving: is the test site updated yet? ----------
  // The test site writes the work-branch version it shows into version.txt.
  // After a save we check it every 20 seconds and say when the change is live.
  var watcher = core.siteWatch({ base: BASE, api: api, T: T, status: status, setStatus: setStatus, dirty: dirty, beforeReload: function () { original = JSON.stringify(data); } });
  function watchSite() { watcher.watch(); }
  function followSave(commitSha) { watcher.follow(commitSha, trNote(), trKind()); }

  // ---------- save ----------
  var lastCommit = "";

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
  var trPairs = function () {
    var p = [{ now: data, before: JSON.parse(original) }];
    if (textsOrig) p.push({ now: texts, before: JSON.parse(textsOrig) });
    // Posters' titles and texts (in the project files).
    p.push({ now: { caps: projects.map(function (x) { return x.cap || (x.cap = capOf(null)); }) }, before: { caps: projects.map(function (x) { return JSON.parse(x.origCap || JSON.stringify(capOf(null))); }) } });
    return p;
  };
  function trNote() { var n = window.BubaTranslate ? window.BubaTranslate.note(trRes) : ""; return n ? " " + n : ""; }
  function trKind() { return trRes.failed ? "warn" : "ok"; }
  function save() {
    if (!dirty() || translating) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    translating = true; busy = true; saveBtn.disabled = true; trRes = { n: 0 };
    trReady
      .then(function () { return window.BubaTranslate ? window.BubaTranslate.run(trPairs(), { topOnly: true, onStart: function (m) { setStatus(m); } }) : { n: 0 }; })
      .then(function (r) { trRes = r; }, function () { trRes = { n: 0, failed: true }; })
      .then(function () { translating = false; saveNow(); });
  }
  // A picture added to a project's page gallery (its first gallery section, or a new one).
  function addPictures(d, adds) {
    if (!Array.isArray(d.sections)) d.sections = [];
    var sec = d.sections.filter(function (x) { return x && x.type === "gallery"; })[0];
    if (!sec) { sec = { type: "gallery", hidden: false, heading_en: "", heading_he: "", images: [] }; d.sections.push(sec); }
    if (!Array.isArray(sec.images)) sec.images = [];
    adds.forEach(function (a) {
      if (sec.images.some(function (x) { return x && x.image === a.image; })) return;
      sec.images.push({ image: a.image, link: "", alt_en: a.alt_en, alt_he: a.alt_he, title_en: "", title_he: "", note_en: "", note_he: "", caption: "hidden", on_home: false, frame: "natural", focus: "center" });
    });
    return d;
  }
  // A poster's fields as they are now (what this save sends for that project).
  function posterFields(p) {
    return { title_he: p.title_he, title_en: p.title_en, cover: p.cover, in_posters: p.in_posters, order: p.order, poster_w: p.poster_w, poster_w_m: p.poster_w_m, cap: JSON.parse(JSON.stringify(p.cap || capOf(null))) };
  }
  // After a project's file is written: what was sent is now what is saved
  // (a change made while saving stays unsaved).
  function markSaved(p, f) {
    p.isNew = false;
    p.orig_he = f.title_he; p.orig_en = f.title_en;
    if (f.cover) p.origCover = "/" + f.cover.path;
    if (p.cover === f.cover) p.cover = null;
    p.orig_in_posters = f.in_posters; p.orig_order = f.order; p.orig_poster_w = f.poster_w; p.orig_poster_w_m = f.poster_w_m;
    p.origCap = JSON.stringify(f.cap);
  }
  function saveNow() {
    lastCommit = "";
    busy = false;
    if (!dirty()) { refreshStatus(); return; }
    saveBtn.disabled = true;
    setStatus(T.saving);
    busy = true;
    var used = {};
    var all = [data.hero_image, data.feature_image].concat(data.gallery.map(function (g) { return g && g.image; }))
      .concat(projects.map(function (p) { return p.cover ? p.cover.path : ""; }))
      .concat([].concat.apply([], Object.keys(pageAdds).map(function (k) { return pageAdds[k].map(function (a) { return a.image; }); })));
    all.forEach(function (p) { var u = uploads[norm(p)]; if (u && !u.done) used[norm(p)] = true; });
    // What is sent now. Edits made while saving stay "unsaved" afterwards (they are not lost).
    var sentData = JSON.stringify(data), sentTexts = JSON.parse(JSON.stringify(texts)), origTexts = JSON.parse(textsOrig || "{}");
    var files = [];
    var newSlugs = created().map(function (p) { return p.slug; });
    // New project files: the same fields the admin panel creates (and this page's poster settings).
    created().forEach(function (p) {
      var f = posterFields(p);
      var adds = (pageAdds[p.slug] || []).slice();
      var d = {
        title_en: f.title_en, title_he: f.title_he, show_title: true, visible: true, featured: true, order: f.order, poster_order: f.order, title_in_gallery: false,
        categories: [], text_en: "", text_he: "", description_en: "", description_he: "",
        cover: f.cover ? "/" + f.cover.path : "", cover_alt_en: f.cover ? f.cover.alts.en : "", cover_alt_he: f.cover ? f.cover.alts.he : "",
        video_url: "", video_file: "", gallery: [], details: [], sections: [],
      };
      if (f.in_posters === false) d.in_posters = false;
      if (f.poster_w) d.poster_w = f.poster_w;
      if (f.poster_w_m) d.poster_w_m = f.poster_w_m;
      CAP_KEYS.forEach(function (k) { if (f.cap[k] && f.cap[k] !== "hidden") d[k] = f.cap[k]; });
      if (adds.length) addPictures(d, adds);
      files.push({ path: "content/projects/" + p.slug + ".json", sha: "", text: JSON.stringify(d, null, 2) + "\n", message: "New project: " + (f.title_en || f.title_he || p.slug) + " (created on the homepage)", saved: function () { markSaved(p, f); savedAdds(p.slug, adds); } });
    });
    if (sentData !== original) files.push({ path: FILE, sha: sha, text: JSON.stringify(data, null, 2) + "\n", message: "Homepage: edited on the page", saved: function (v) { sha = v; original = sentData; } });
    // Pictures added to existing projects' page galleries: added to each file as it is now.
    Object.keys(pageAdds).forEach(function (slug) {
      var adds = pageAdds[slug].slice();
      if (!adds.length || newSlugs.indexOf(slug) >= 0) return;
      files.push({ path: "content/projects/" + slug + ".json", merge: function (d) { return addPictures(d, adds); }, message: "Project " + slug + ": picture added (edited on the homepage)", saved: function () { savedAdds(slug, adds); } });
    });
    // Interface texts and services: only if changed here, and only if the file did not change elsewhere.
    var setOrig = function (key) { var o = JSON.parse(textsOrig || "{}"); o[key] = sentTexts[key]; textsOrig = JSON.stringify(o); };
    if (textsOrig && JSON.stringify(sentTexts.labels) !== JSON.stringify(origTexts.labels)) files.push({ path: "content/labels.json", sha: labelsSha, text: JSON.stringify(sentTexts.labels, null, 2) + "\n", message: "Homepage: texts edited on the page", saved: function (v) { labelsSha = v; setOrig("labels"); } });
    if (textsOrig && sentTexts.services && JSON.stringify(sentTexts.services) !== JSON.stringify(origTexts.services)) files.push({ path: "content/services.json", sha: servicesSha, text: JSON.stringify(sentTexts.services, null, 2) + "\n", message: "Services: names edited on the homepage", saved: function (v) { servicesSha = v; setOrig("services"); } });
    // Existing projects changed here: only their names and poster fields change; everything else in the file is kept.
    renamed().forEach(function (p) {
      var f = posterFields(p), origOrder = p.orig_order, origCap = JSON.parse(p.origCap || "{}");
      files.push({
        path: "content/projects/" + p.slug + ".json",
        merge: function (d) {
          d.title_he = f.title_he; d.title_en = f.title_en;
          // The homepage's own poster picture and order: the projects page keeps its cover and order.
          if (f.cover) { d.poster_image = "/" + f.cover.path; d.poster_alt_he = f.cover.alts.he; d.poster_alt_en = f.cover.alts.en; }
          if (f.in_posters === false) d.in_posters = false; else delete d.in_posters;
          if (f.order !== origOrder) d.poster_order = f.order;
          if (f.poster_w) d.poster_w = f.poster_w; else delete d.poster_w;
          if (f.poster_w_m) d.poster_w_m = f.poster_w_m; else delete d.poster_w_m;
          // The poster's title and text: written only when there is one (or there was one).
          CAP_KEYS.forEach(function (k) {
            // The description is written only when changed here (the project's
            // own page edits it too).
            if (/^cover_alt_/.test(k)) { if (f.cap[k] !== (origCap[k] || "")) d[k] = f.cap[k]; return; }
            if (f.cap[k] && f.cap[k] !== "hidden") d[k] = f.cap[k]; else if (k === "poster_caption_pos") delete d[k]; else if (k in d) d[k] = k === "poster_caption" ? "hidden" : "";
          });
          return d;
        },
        message: "Project " + p.slug + ": changed on the homepage (name, poster, order or poster size)",
        saved: function () { markSaved(p, f); },
      });
    });
    var wrote = 0;
    // Every file is checked first, then the pictures go up, then the files (js/editor-core.js).
    core.saveFiles({
      api: api, branch: BRANCH,
      uploads: Object.keys(used).map(function (path) { return { path: path, file: uploads[path].file, message: "Upload picture (homepage, edited on the page)", done: function () { uploads[path].done = true; } }; }),
      files: files,
    })
      .then(function (r) { wrote = r.wrote; return window.BubaStyle ? window.BubaStyle.save("homepage") : ""; })
      .then(function (c) {
        if (c) { lastCommit = c; wrote++; }
        busy = false;
        saveBtn.disabled = !dirty();
        followSave(lastCommit);
        render();
        if (dirty()) refreshStatus();
      })
      .catch(function (err) {
        busy = false;
        saveBtn.disabled = false;
        render();
        // A save that was checked and found wrong, or could not be checked (js/editor-core.js).
        if (core.saveErrorText(err)) { setStatus(core.saveErrorText(err) + (wrote || err.wrote ? " " + T.errPartial : ""), "error"); return; }
        if (wrote || err.wrote) { setStatus(T.errPartial, "error"); return; }
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }
  // Pictures added by a save: off the waiting list (others added meanwhile stay), and remembered for "Undo".
  function savedAdds(slug, adds) {
    adds.forEach(function (a) { addedSaved[slug + "|" + a.image] = true; });
    if (pageAdds[slug]) pageAdds[slug] = pageAdds[slug].filter(function (a) { return adds.indexOf(a) < 0; });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    leaving = true;
    original = JSON.stringify(data); // allow leaving without the browser's own warning
    location.reload();
  }
})();

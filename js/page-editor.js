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
 *     data-ed-tags="h3,p.muted,p"   (optional) element for each text when it is missing
 *     data-ed-bare-en="name"        (optional) these texts are "name" in English, not "name_en"
 *     data-ed-notr="name"           (optional) never translated (names of people); an empty
 *                                   other language gets the same text
 *     data-ed-photo="photo"         (optional) each item has a picture in this field
 *   data-multiline (on a data-ed)   a text of several paragraphs (Enter = new line)
 *   data-ed-plain (on a data-ed)    one value for both languages ("field", not "field_<lang>");
 *                                   never translated
 *   data-ed-kind="email"|"phone"    checked when leaving the text; a wrong value is not kept
 *   <template data-ed-missing>      a place for a detail that is empty today: shown only
 *                                   while editing, so it can be filled in
 *   data-ed-hide                    hidden while editing (the editor shows its own version)
 *   on a list, also:
 *     data-ed-photo-main            an item is its picture: "Add" opens the pictures, and
 *                                   the texts (e.g. a description for blind visitors) are optional
 *     data-ed-multi="text"          these texts have several paragraphs (Enter = new line)
 *     data-ed-slug="slug"           each item needs a fixed English name (made when saving)
 * A product's file (content/products/<name>.json) also gets a panel for its
 * price, availability, category and showing in the shop; the shop's file
 * (content/shop.json) gets "New product", which writes a new product's file.
 * Money settings (currencies, VAT, shipping, payment) stay in the admin panel.
 * Texts are saved in the page's language only; everything else in the files
 * is kept exactly as it is. Saving writes to the work branch with the
 * owner's own GitHub sign-in, and never over a file changed elsewhere.
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
  var box = document.querySelector("[data-ed-file]");
  if (!launcher || !box) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var FILE = box.getAttribute("data-ed-file");
  var LABELS = "content/labels.json";
  if (!/^content\/(products\/)?[a-z0-9-]+\.json$/.test(FILE || "")) return;
  var PRODUCT = /^content\/products\//.test(FILE), SHOP = FILE === "content/shop.json";
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
    titleNote: "הכותרת הזאת היא גם שם הכפתור בתפריט, בשפת הדף בלבד.",
    langNote: "כותבים כאן בעברית. עם ״תרגום אוטומטי לאנגלית״ (למעלה) האנגלית מתעדכנת בשמירה. לתיקון התרגום — פתחו את הדף באנגלית.",
    emptyBack: "הטקסט ריק, ולכן יוצג הטקסט הרגיל.",
    nameEmpty: "פריט בלי שם לא מוצג באתר (בשפה הזאת).",
    notShown: "לא מוצג בדף בשפה הזאת — חסר שם",
    add: "הוספה", remove: "מחיקה", earlier: "הזזה למקום הקודם", later: "הזזה למקום הבא", prevBtn: "→ קודם", nextBtn: "הבא ←", more: "⋯ עוד", drag: "גררו כדי לשנות את הסדר",
    removed: "נמחק. אפשר לבטל עם ״ביטול פעולה״.",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״פתיחת העריכה המתקדמת״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את הדף מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא נשמר, והאתר לא השתנה.",
    errPartial: "חלק מהשינויים נשמרו וחלק לא (אולי קובץ השתנה בינתיים במקום אחר). צאו מהעריכה, רעננו את הדף ובדקו מה חסר.",
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
    history: "גרסאות קודמות", historyLoaded: "גרסה קודמת נטענה לדף. בדקו ולחצו ״שמירה״ כדי לקבוע אותה.", historyFailed: "לא הצלחתי לטעון את הגרסה מ־GitHub.",
    historyTitle: "גרסאות קודמות של הדף",
    historyNote: "בחירה בגרסה טוענת לדף את התוכן כפי שהיה כשינוי שלא נשמר. רק ״שמירה״ קובעת. אפשר לבטל עם ״ביטול פעולה״. כותרות הדף (שמשותפות גם לתפריט) וסגנונות הטקסט לא משתנים.",
    trDone: "תורגמו לאנגלית {n} טקסטים. לתיקון — פתחו את הדף באנגלית, וכבו שם את ״תרגום אוטומטי״ לפני השמירה.",
    trFail: "התרגום לאנגלית לא הצליח (אולי נגמרה המכסה היומית החינמית, או שאין אינטרנט). העברית נשמרה; האנגלית לא השתנתה.",
    tip5: "״תרגום אוטומטי״ מתרגם בשמירה כל טקסט ששיניתם לשפה השנייה (חינם). מתקנים תרגום? כבו אותו לפני השמירה.",
    photoAdd: "הוספת תמונה", photoChange: "החלפת התמונה", photoRemove: "הסרת התמונה", photoRemoved: "התמונה הוסרה. אפשר לבטל עם ״ביטול פעולה״.",
    pickTitle: "בחירת תמונה", pickLoading: "טוען תמונות…", pickUpload: "העלאה מהמחשב או מהטלפון:", uploadNote: "(תישמר באתר רק בלחיצה על ״שמירה״)",
    choose: "בחירה", close: "סגירה", newBadge: "חדשה — תישמר בשמירה",
    bodyHint2: "טקסט (לחצו כדי לכתוב; Enter = שורה חדשה, שורה ריקה = פסקה חדשה)",
    hint_email: "כתובת מייל (לחצו כדי לכתוב)", hint_email_2: "מייל נוסף (לא חובה)", hint_phone: "טלפון או וואטסאפ (לא חובה)", hint_location: "אזור (לא חובה), למשל: צפון וכל הארץ",
    badEmail: "זו לא כתובת מייל תקינה. הכתובת הקודמת נשארה.", badPhone: "מספר טלפון יכול לכלול ספרות, רווחים, מקפים, סוגריים ו־+ בהתחלה. המספר הקודם נשאר.",
    plainNote: "מייל וטלפון — אותו ערך בשתי השפות. הם מופיעים גם בתחתית כל דף ובהזמנות מהחנות.",
    hint_role: "תפקיד (לחצו כדי לכתוב)", hint_bio: "כמה שורות על היוצר (לחצו כדי לכתוב)",
    nameShared: "שם של אדם לא מתורגם. אם אין לו שם בשפה השנייה, יישמר שם אותו שם.",
    hint_title: "שם המוצר (לחצו כדי לכתוב)",
    hint_images_alt: "תיאור התמונה לעיוורים (לא חובה)", hint_details_title: "כותרת, למשל: חומרים, מידות, טיפול", hint_details_text: "הטקסט (Enter = שורה חדשה)", hint_categories_name: "שם הקטגוריה (לחצו כדי לכתוב)",
    list_categories: "קטגוריות בחנות", note_categories: "שם ותמונה לכל קטגוריה. קטגוריה מוצגת בחנות רק כשיש בה מוצר. מחיקת קטגוריה לא מוחקת מוצרים: הם יוצגו תחת ״הכול״.",
    list_images: "תמונות המוצר", note_images: "הראשונה היא התמונה הראשית, והיא מופיעה גם בחנות. את הסדר משנים בגרירה או בחצים.",
    list_details: "פרטים נוספים (נפתחים בלחיצה)", note_details: "למשל חומרים, מידות או הוראות טיפול. משלוח והחזרות — בכלי הניהול.",
    photoNeeded: "מוצר בלי תמונה לא מוצג בחנות.",
    panelTitle: "פרטי המוצר", price: "מחיר", priceAbroad: "מחיר לחו״ל (לא חובה)", priceHint: "ריק = בלי מחיר", availability: "זמינות", category: "קטגוריה", noCategory: "בלי קטגוריה", visible: "להציג בחנות",
    moneyNote: "מטבע, מע״מ, משלוח ודרכי תשלום — בכלי הניהול (״הגדרות החנות״).",
    badPrice: "מחיר הוא מספר, למשל 120 או 49.90. המחיר הקודם נשאר.", hiddenNote: "המוצר מוסתר: אחרי השמירה הוא לא יוצג בחנות.",
    newProduct: "מוצר חדש", newTitle: "מוצר חדש בחנות", newName: "שם המוצר", newPrice: "מחיר בשקלים (לא חובה)", newCategory: "קטגוריה (לא חובה)", newPhoto: "תמונה ראשית (חובה)", choosePhoto: "בחירת תמונה", create: "יצירת המוצר", creating: "יוצר את המוצר…",
    needName: "כתבו שם למוצר.", needPhoto: "בחרו תמונה. מוצר בלי תמונה לא מוצג בחנות.",
    newNote: "המוצר יוצג בחנות עם התמונה, השם והמחיר. תיאור, עוד תמונות וזמינות — בדף המוצר, ב״עריכה על הדף״. כשנוסף המוצר האמיתי הראשון, מוצרי הדוגמה נעלמים מהחנות.",
    created: "המוצר נוצר ✓ הוא יופיע בחנות כשאתר הבדיקה יתעדכן (בדרך כלל 2–3 דקות).", openProduct: "לדף המוצר",
    errCreate: "יצירת המוצר נכשלה, והמוצר לא נוסף לחנות. בדקו את החיבור ונסו שוב.", priceNumber: "מחיר הוא מספר, למשל 120 או 49.90.",
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
    add: "Add", remove: "Delete", earlier: "Move to the previous place", later: "Move to the next place", prevBtn: "← Earlier", nextBtn: "Later →", more: "⋯ More", drag: "Drag to change the order",
    removed: "Deleted. You can undo it.",
    signIn: "To edit, sign in once to the admin panel in this browser (\"All management\" → \"Open advanced editing\"), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the page from GitHub.",
    errSave: "Saving failed. Nothing was saved, and the site did not change.",
    errPartial: "Some changes were saved and some were not (perhaps a file changed elsewhere meanwhile). Leave editing, reload the page and check what is missing.",
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
    history: "Earlier versions", historyLoaded: "An earlier version is loaded on the page. Check it and press \"Save\" to keep it.", historyFailed: "Could not load the version from GitHub.",
    historyTitle: "Earlier versions of this page",
    historyNote: "Choosing a version loads the content as it was onto the page as an unsaved change. Only \"Save\" makes it final. You can undo it. The page titles (shared with the menu) and the text styles do not change.",
    trDone: "Translated to Hebrew: {n}. To fix it, open the page in Hebrew and turn off \"Auto-translate\" there before saving.",
    trFail: "Translating to Hebrew failed (maybe the free daily allowance ran out, or there is no internet). The English is saved; the Hebrew did not change.",
    tip5: "\"Auto-translate\" translates every text you changed into the other language when saving (free). Fixing a translation? Turn it off before saving.",
    photoAdd: "Add a picture", photoChange: "Replace the picture", photoRemove: "Remove the picture", photoRemoved: "Picture removed. You can undo it.",
    pickTitle: "Choose a picture", pickLoading: "Loading pictures…", pickUpload: "Upload from your computer or phone:", uploadNote: "(saved on the site only when you press \"Save\")",
    choose: "Choose", close: "Close", newBadge: "New — saved when you save",
    bodyHint2: "Text (click to write; Enter = new line, an empty line = new paragraph)",
    hint_email: "Email address (click to write)", hint_email_2: "Another email (optional)", hint_phone: "Phone or WhatsApp (optional)", hint_location: "Area (optional), e.g. North and all of Israel",
    badEmail: "That is not a valid email address. The previous address was kept.", badPhone: "A phone number can have digits, spaces, dashes, brackets and a + at the start. The previous number was kept.",
    plainNote: "Email and phone are the same in both languages. They also show at the bottom of every page and in shop orders.",
    hint_role: "Role (click to write)", hint_bio: "A few lines about them (click to write)",
    nameShared: "A person's name is not translated. If there is no name in the other language, the same name is saved there.",
    hint_title: "Product name (click to write)",
    hint_images_alt: "Picture description for blind visitors (optional)", hint_details_title: "Heading, e.g. Materials, Size, Care", hint_details_text: "The text (Enter = new line)", hint_categories_name: "Category name (click to write)",
    list_categories: "Shop categories", note_categories: "A name and a picture for each category. A category shows in the shop only when it has a product. Deleting a category does not delete products: they show under \"All\".",
    list_images: "Product pictures", note_images: "The first is the main picture, also shown in the shop. Drag or use the arrows to change the order.",
    list_details: "More details (open on click)", note_details: "For example materials, size or care. Shipping and returns are in the admin panel.",
    photoNeeded: "A product without a picture is not shown in the shop.",
    panelTitle: "Product details", price: "Price", priceAbroad: "Price abroad (optional)", priceHint: "Empty = no price", availability: "Availability", category: "Category", noCategory: "No category", visible: "Show in the shop",
    moneyNote: "Currency, VAT, shipping and payment methods are in the admin panel (\"Shop settings\").",
    badPrice: "A price is a number, for example 120 or 49.90. The previous price was kept.", hiddenNote: "The product is hidden: after saving it will not show in the shop.",
    newProduct: "New product", newTitle: "A new product in the shop", newName: "Product name", newPrice: "Price in shekels (optional)", newCategory: "Category (optional)", newPhoto: "Main picture (required)", choosePhoto: "Choose a picture", create: "Create the product", creating: "Creating the product…",
    needName: "Write a name for the product.", needPhoto: "Choose a picture. A product without a picture is not shown in the shop.",
    newNote: "The product shows in the shop with its picture, name and price. Description, more pictures and availability: on the product's page, with \"Edit on the page\". When the first real product is added, the example products leave the shop.",
    created: "The product was created ✓ It will show in the shop when the test site updates (usually 2–3 minutes).", openProduct: "Open the product page",
    errCreate: "Creating the product failed, and it was not added to the shop. Check the connection and try again.", priceNumber: "A price is a number, for example 120 or 49.90.",
  };

  // ---------- small helpers ----------
  var lastCommit = "";
  var api = core.github(launcher, function (sha) { lastCommit = sha; }).api;
  var encPath = function (p) { return p.split("/").map(encodeURIComponent).join("/"); };
  var ref = "?ref=" + encodeURIComponent(BRANCH);
  var styleLink = document.querySelector('link[href*="css/styles.css"]');
  var BASE = styleLink ? styleLink.getAttribute("href").split("css/styles.css")[0] : "";
  function clean(text) { return String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }

  // ---------- state ----------
  var state = null, original = "", sha = "", labelsSha = "";
  var snap = function () { return JSON.stringify(state); };
  // Text styles (size, alignment, spacing, font: js/text-style.js) are saved with the page.
  var styleDirty = function () { return !!(window.BubaStyle && window.BubaStyle.dirty()); };
  var dirty = function () { return !!state && (snap() !== original || styleDirty()); };


  // ---------- earlier versions (the shared js/history.js, loaded on first use) ----------
  var histBtn = button(T.history, openHistory, "pe-btn pe-ghost");
  histBtn.disabled = true;
  function openHistory() {
    core.history(launcher, {
      api: api, path: FILE, branch: BRANCH, title: T.historyTitle, note: T.historyNote, load: loadVersion,
      onLoaded: function () { setStatus(T.historyLoaded, "warn"); },
      onError: function () { setStatus(T.historyFailed, "error"); },
      onMissing: function () { setStatus(T.historyFailed, "error"); },
    });
  }
  // The page's file as it was at an earlier save (the shared titles stay as they are now).
  function loadVersion(commitSha) {
    return api("/contents/" + encPath(FILE) + "?ref=" + encodeURIComponent(commitSha)).then(function (res) {
      var old = JSON.parse(b64ToUtf8(res.content));
      if (!old || typeof old !== "object" || Array.isArray(old)) throw new Error("bad file");
      state.file = old;
      commit(); fill(); drawLists(); refreshStatus();
    });
  }

  // ---------- toolbar ----------
  var status = el("span", { "class": "pe-status", role: "status", "aria-live": "polite" });
  var saveBtn = button(T.save, save, "pe-btn pe-primary");
  var undoBtn = button("↶ " + T.undo, undo, "pe-btn", T.undoTip);
  undoBtn.disabled = true;
  // Automatic translation: the shared js/auto-translate.js (its switch joins this bar).
  var trReady = new Promise(function (resolve) {
    var src = launcher.getAttribute("data-tr-src");
    if (window.BubaTranslate || !src) { resolve(); return; }
    var sc = document.createElement("script");
    sc.src = src; sc.onload = sc.onerror = function () { resolve(); };
    document.head.appendChild(sc);
  });
  var trOn = function () { return !!(window.BubaTranslate && window.BubaTranslate.enabled()); };
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }, [
      button("? " + T.help, function () { showTip(true); }, "pe-btn pe-ghost"),
      histBtn,
    ]),
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
  trReady.then(function () { if (window.BubaTranslate) bar.querySelector(".pe-bar-layout").appendChild(window.BubaTranslate.toggle()); });
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
  Promise.all([getFile(FILE), getFile(LABELS), PRODUCT ? getFile("content/shop.json") : null])
    .then(function (r) {
      sha = r[0].sha; labelsSha = r[1].sha;
      if (r[2] && Array.isArray(r[2].data.categories)) shopCats = r[2].data.categories;
      state = { file: r[0].data || {}, labels: r[1].data || {} };
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
  var KINDS = {
    email: { re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: "badEmail", href: function (v) { return "mailto:" + v; } },
    phone: { re: /^\+?[\d\s\-()]{6,20}$/, msg: "badPhone", href: function (v) { return "tel:" + v.replace(/[^\d+]/g, ""); } },
  };
  function fieldPart(node) {
    var plain = node.hasAttribute("data-ed-plain");
    var key = node.getAttribute("data-ed") + (plain ? "" : "_" + lang);
    var kind = KINDS[node.getAttribute("data-ed-kind") || ""];
    if (kind) {
      // Checked when leaving the text: an empty value is allowed (no detail), a wrong one is not kept.
      var before = state.file[key] || "";
      parts.push({ node: node, get: function () { return state.file[key] || ""; } });
      editable(node, T["hint_" + node.getAttribute("data-ed")] || T.textHint, function (v) { state.file[key] = v; }, function () {
        var v = state.file[key] || "";
        if (v && !kind.re.test(v)) { state.file[key] = before; node.textContent = before; setStatus(T[kind.msg], "warn"); return; }
        before = v;
        if (node.tagName === "A") { if (v) node.setAttribute("href", kind.href(v)); else node.removeAttribute("href"); }
      });
      return;
    }
    parts.push({ node: node, get: function () { return state.file[key] || ""; } });
    // A text of several paragraphs is shown as written (blank line = new paragraph).
    if (node.hasAttribute("data-multiline")) node.textContent = state.file[key] || "";
    editable(node, node.hasAttribute("data-multiline") ? T.bodyHint2 : node.classList.contains("lede") ? T.introHint : T["hint_" + node.getAttribute("data-ed")] || T.textHint, function (v) { state.file[key] = v; });
  }
  function labelPart(node) {
    var key = node.getAttribute("data-ed-label") + "_" + lang, usual = node.textContent;
    parts.push({ node: node, get: function () { return state.labels[key] || usual; } });
    editable(node, T.textHint, function (v) { if (v) state.labels[key] = v; else delete state.labels[key]; }, function () {
      // Only a text left empty goes back to the usual one (leaving it untouched is fine).
      if (!clean(node.innerText)) { node.textContent = usual; setStatus(T.emptyBack, "warn"); }
    });
    if (node.tagName === "H1") node.parentNode.insertBefore(el("p", { "class": "pe-note pe-title-note", text: T.titleNote }), node.nextSibling);
  }
  var refreshers = []; // panels with fields (a product's price…): redrawn after undo
  function fill() {
    parts.forEach(function (p) { if (document.activeElement !== p.node) p.node.textContent = p.get(); });
    refreshers.forEach(function (r) { r(); });
  }

  // ---------- lists ----------
  var lists = []; // { node, field, subs, tpl }
  function start() {
    // Places for details that are empty today come out of their <template>.
    Array.prototype.forEach.call(box.querySelectorAll("template[data-ed-missing]"), function (tp) {
      tp.parentNode.insertBefore(tp.content.cloneNode(true), tp);
      tp.remove();
    });
    if (box.querySelector("[data-ed-plain]")) {
      var first = box.querySelector("[data-ed-plain]").closest("dl") || box.querySelector("[data-ed-plain]");
      first.parentNode.insertBefore(el("p", { "class": "pe-note pe-plain-note", text: T.plainNote }), first);
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed-label]"), labelPart);
    // An opening line that is empty today still gets a place to write it.
    if (!box.querySelector('[data-ed="intro"]')) {
      var head = box.querySelector(".page-head");
      if (head && "intro_" + lang in state.file) head.appendChild(el("p", { "class": "lede", "data-ed": "intro", "data-ts": PAGE + "/intro" }));
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed]"), function (n) { if (!n.closest("[data-ed-list]")) fieldPart(n); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed-list]"), function (n) {
      var tpl = n.querySelector("[data-ed-item]");
      var words = function (a) { return (n.getAttribute(a) || "").split(",").filter(Boolean); };
      var field = n.getAttribute("data-ed-list");
      lists.push({ node: n, field: field, subs: (n.getAttribute("data-ed-subs") || "name").split(","), tpl: tpl ? tpl.cloneNode(true) : el("li"),
        tags: words("data-ed-tags"), bare: words("data-ed-bare-en"), notr: words("data-ed-notr"), photo: n.getAttribute("data-ed-photo") || "",
        photoMain: n.hasAttribute("data-ed-photo-main"), multi: words("data-ed-multi"), slug: n.getAttribute("data-ed-slug") || "", ts: words("data-ts-subs") });
      // A list shown only while editing gets its own heading and a short explanation.
      if (T["list_" + field]) {
        n.parentNode.insertBefore(el("h2", { "class": "section-label pe-list-title", text: T["list_" + field] }), n);
        if (T["note_" + field]) n.parentNode.insertBefore(el("p", { "class": "pe-note pe-list-note", text: T["note_" + field] }), n);
      }
    });
    var hd = box.querySelector(".page-head") || (PRODUCT && box.querySelector(".product-info"));
    if (hd && hd.classList.contains("product-info")) hd.insertBefore(el("p", { "class": "pe-note pe-proj-note", text: T.langNote }), hd.firstChild);
    else if (hd) hd.parentNode.insertBefore(el("p", { "class": "pe-note pe-proj-note", text: T.langNote }), hd.nextSibling);
    if (PRODUCT) productPanel();
    if (SHOP) newProductButton();
    drawLists();
  }
  // The key of a list text in a language ("name_he", "name_en", or "name" for English when bare).
  function keyOf(L, sub, lg) { return lg === "en" && L.bare.indexOf(sub) >= 0 ? sub : sub + "_" + lg; }
  function tagFor(L, k) {
    var spec = (L.tags[k] || (k === 0 ? "h2" : "p")).split(".");
    var n = el(spec[0]);
    if (spec[1]) n.className = spec.slice(1).join(" ");
    return n;
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
        // The item's picture: what the file says now (not the copied template's picture).
        var oldImg = li.querySelector("img");
        if (oldImg) oldImg.remove();
        if (L.photo && it[L.photo]) {
          var pic = picture(it[L.photo]);
          li.insertBefore(pic, li.firstChild);
          if (uploads[norm(it[L.photo])]) li.insertBefore(el("span", { "class": "pe-badge pe-new", text: T.newBadge }), pic.nextSibling);
        }
        L.subs.forEach(function (sub, k) {
          var n = li.querySelector('[data-ed-sub="' + sub + '"]');
          if (!n) { n = tagFor(L, k); n.setAttribute("data-ed-sub", sub); if (L.ts[k]) n.setAttribute("data-ts", L.ts[k]); li.appendChild(n); }
          var key = keyOf(L, sub, lang);
          n.textContent = it[key] || "";
          var shared = L.notr.indexOf(sub) >= 0;
          if (L.multi.indexOf(sub) >= 0) n.setAttribute("data-multiline", "");
          editable(n, T["hint_" + L.field + "_" + sub] || T["hint_" + sub] || (k === 0 ? T.nameHint : T.bodyHint), function (v) { it[key] = v; }, function () {
            if (k === 0 && !L.photoMain) {
              // The "no name" mark follows the name as it is written.
              var miss = li.querySelector(".pe-missing");
              if (it[key] && miss) miss.remove();
              else if (!it[key] && !miss) li.insertBefore(el("span", { "class": "pe-missing", text: T.notShown }), li.querySelector(".pe-list-tools"));
            }
            if (k === 0 && !it[key] && !L.photoMain) setStatus(T.nameEmpty, "warn"); else if (shared && it[key] && !it[keyOf(L, sub, other)]) setStatus(T.nameShared);
          });
        });
        if (L.photoMain ? !it[L.photo] : !it[keyOf(L, L.subs[0], lang)]) li.appendChild(el("span", { "class": "pe-missing", text: L.photoMain ? T.photoNeeded : T.notShown }));
        var tools = [
          button(T.prevBtn, function () { move(L, i, -1); }, "pe-btn pe-move", T.earlier),
          button(T.remove, function () { items.splice(i, 1); changed(); setStatus(T.removed, "warn"); }, "pe-btn pe-danger"),
          button(T.nextBtn, function () { move(L, i, 1); }, "pe-btn pe-move", T.later),
        ];
        if (L.photo) {
          tools.push(button(it[L.photo] ? T.photoChange : T.photoAdd, function () {
            pickPicture(function (path) { it[L.photo] = "/" + path; changed(); });
          }, "pe-btn"));
          if (it[L.photo] && !L.photoMain) tools.push(button(T.photoRemove, function () { it[L.photo] = ""; changed(); setStatus(T.photoRemoved, "warn"); }, "pe-btn"));
        }
        li.appendChild(el("div", { "class": "pe-tools pe-list-tools" }, tools));
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
        addBox = el("div", { "class": "pe-add" }, [button("+ " + (L.photoMain ? T.photoAdd : T.add), function () {
          var blank = {};
          L.subs.forEach(function (sub) { blank[keyOf(L, sub, "he")] = ""; blank[keyOf(L, sub, "en")] = ""; });
          if (L.photo) blank[L.photo] = "";
          var push = function () {
            (Array.isArray(state.file[L.field]) ? state.file[L.field] : (state.file[L.field] = [])).push(blank);
            changed();
            var last = L.node.lastElementChild && L.node.lastElementChild.querySelector("[data-ed-sub]");
            if (last && !L.photoMain) last.focus();
          };
          // A list of pictures: the new item starts with choosing its picture.
          if (L.photoMain) pickPicture(function (path) { blank[L.photo] = "/" + path; push(); });
          else push();
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

  // ---------- fixed English names (data-ed-slug) ----------
  function slugify(t) {
    return String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "");
  }
  // A new item (a new category…) gets a fixed name from its English name, once.
  function giveSlugs() {
    lists.forEach(function (L) {
      if (!L.slug) return;
      var items = state.file[L.field] || [], taken = {};
      items.forEach(function (it) { if (it[L.slug]) taken[it[L.slug]] = true; });
      items.forEach(function (it) {
        if (it[L.slug]) return;
        var base = slugify(it[keyOf(L, L.subs[0], "en")]) || (L.field === "categories" ? "category" : "item") + "-" + Date.now().toString(36);
        var sl = base, n = 2;
        while (taken[sl]) sl = base + "-" + n++;
        taken[sl] = true;
        it[L.slug] = sl;
      });
    });
  }

  // ---------- a product: price, availability, category, showing ----------
  var shopCats = [];
  var SYM = { ILS: "₪", USD: "$", EUR: "€" };
  var PRICE = /^\d{1,7}(\.\d{1,2})?$/;
  function catName(c) { return String(c["name_" + lang] || c["name_" + other] || c.slug || ""); }
  function productPanel() {
    var at = box.querySelector(".buy-box");
    if (!at) return;
    var choices = {};
    try { choices = JSON.parse(box.getAttribute("data-ed-choices") || "{}"); } catch (e) { choices = {}; }
    function priceField(key, curKey, curDefault, label) {
      var input = el("input", { type: "text", inputmode: "decimal", "class": "pe-input pe-price", "data-ed-price": key, placeholder: T.priceHint, dir: "ltr", autocomplete: "off" });
      var cur = el("span", { "class": "pe-cur", dir: "ltr" });
      function show() {
        var v = state.file[key], c = state.file[curKey] || curDefault;
        if (document.activeElement !== input) input.value = typeof v === "number" ? String(v) : "";
        cur.textContent = (SYM[c] ? SYM[c] + " " : "") + c;
      }
      input.addEventListener("change", function () {
        var raw = input.value.trim().replace(",", ".");
        if (!raw) delete state.file[key];
        else if (!PRICE.test(raw)) { input.value = typeof state.file[key] === "number" ? String(state.file[key]) : ""; setStatus(T.badPrice, "warn"); return; }
        else state.file[key] = Number(raw);
        changed();
      });
      refreshers.push(show); show();
      return el("label", { "class": "pe-field" }, [el("span", { text: label }), el("span", { "class": "pe-price-row" }, [input, cur])]);
    }
    function select(key, options, fallback, label) {
      var sel = el("select", { "class": "pe-input", "data-ed-select": key }, options.map(function (o) { return el("option", { value: o[0], text: o[1] }); }));
      function show() {
        var v = state.file[key] || fallback;
        if (!options.some(function (o) { return o[0] === v; })) sel.appendChild(el("option", { value: v, text: v }));
        sel.value = v;
      }
      sel.addEventListener("change", function () { if (sel.value) state.file[key] = sel.value; else delete state.file[key]; changed(); });
      refreshers.push(show); show();
      return el("label", { "class": "pe-field" }, [el("span", { text: label }), sel]);
    }
    var avail = choices.availability || {};
    var visible = el("input", { type: "checkbox", "data-ed-visible": "" });
    function showVisible() { visible.checked = state.file.visible !== false; }
    visible.addEventListener("change", function () { state.file.visible = visible.checked; changed(); if (!visible.checked) setStatus(T.hiddenNote, "warn"); });
    refreshers.push(showVisible); showVisible();
    var panel = el("fieldset", { "class": "pe-panel" }, [
      el("legend", { text: T.panelTitle }),
      priceField("price", "currency", "ILS", T.price),
      priceField("price_abroad", "currency_abroad", "USD", T.priceAbroad),
      select("availability", Object.keys(avail).map(function (k) { return [k, avail[k]]; }), "available", T.availability),
      select("category", [["", T.noCategory]].concat(shopCats.filter(function (c) { return c && c.slug; }).map(function (c) { return [c.slug, catName(c)]; })), "", T.category),
      el("label", { "class": "pe-check" }, [visible, el("span", { text: T.visible })]),
      el("p", { "class": "pe-note", text: T.moneyNote }),
    ]);
    at.parentNode.insertBefore(panel, at);
  }

  // ---------- the shop: a new product ----------
  function newProductButton() {
    var note = box.querySelector(".pe-proj-note") || box.querySelector(".page-head");
    var wrap = el("div", { "class": "pe-add pe-new-product" }, [button("+ " + T.newProduct, newProductDialog, "pe-btn pe-primary")]);
    note.parentNode.insertBefore(wrap, note.nextSibling);
  }
  function freeSlug(base, n) {
    var sl = n > 1 ? base + "-" + n : base;
    return api("/contents/" + encPath("content/products/" + sl + ".json") + ref).then(function () {
      if (n > 20) throw new Error("name");
      return freeSlug(base, n + 1);
    }, function (err) { if (err.status === 404) return sl; throw err; });
  }
  function newProductDialog() {
    var photo = "";
    var name = el("input", { type: "text", "class": "pe-input", maxlength: "120", "data-new": "name" });
    var price = el("input", { type: "text", inputmode: "decimal", "class": "pe-input", dir: "ltr", "data-new": "price", autocomplete: "off" });
    var cats = (state.file.categories || []).filter(function (c) { return c && c.slug; });
    var cat = el("select", { "class": "pe-input", "data-new": "category" }, [el("option", { value: "", text: T.noCategory })].concat(cats.map(function (c) { return el("option", { value: c.slug, text: catName(c) }); })));
    var preview = el("div", { "class": "pe-new-photo" });
    var msg = el("p", { "class": "pe-note pe-new-msg", role: "status", "aria-live": "polite" });
    var pickBtn = button(T.choosePhoto, function () {
      pickPicture(function (path) { photo = path; preview.textContent = ""; preview.appendChild(picture(path)); pickBtn.textContent = T.photoChange; msg.textContent = ""; });
    }, "pe-btn");
    var createBtn = button(T.create, go, "pe-btn pe-primary");
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.newTitle }, [
      el("div", { "class": "pe-modal-box pe-new-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.newTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("label", { "class": "pe-field" }, [el("span", { text: T.newName }), name]),
        el("label", { "class": "pe-field" }, [el("span", { text: T.newPrice }), price]),
        el("label", { "class": "pe-field" }, [el("span", { text: T.newCategory }), cat]),
        el("div", { "class": "pe-field" }, [el("span", { text: T.newPhoto }), preview, pickBtn]),
        el("p", { "class": "pe-note", text: T.newNote }),
        el("div", { "class": "pe-modal-foot" }, [msg, createBtn]),
      ]),
    ]);
    function close() { dialog.remove(); document.removeEventListener("keydown", onKey); }
    // Escape closes the picture chooser first, when it is open on top.
    function onKey(e) { if (e.key === "Escape" && document.querySelectorAll(".pe-modal").length === 1) close(); }
    document.addEventListener("keydown", onKey);
    document.body.appendChild(dialog);
    name.focus();
    function go() {
      var n = clean(name.value), raw = price.value.trim().replace(",", ".");
      if (!n) { msg.textContent = T.needName; name.focus(); return; }
      if (raw && !PRICE.test(raw)) { msg.textContent = T.priceNumber; price.focus(); return; }
      if (!photo) { msg.textContent = T.needPhoto; pickBtn.focus(); return; }
      createBtn.disabled = true; msg.textContent = T.creating;
      lastCommit = "";
      var titles = {};
      titles["title_" + lang] = n;
      var path = norm(photo);
      (trOn() ? window.BubaTranslate.translate(n).catch(function () { return ""; }) : Promise.resolve(""))
        .then(function (o) {
          titles["title_" + other] = o;
          var base = slugify(lang === "en" ? n : o) || "product-" + Date.now().toString(36);
          if (base === "order" || /^example-/.test(base)) base = "product-" + base;
          return freeSlug(base, 1);
        })
        .then(function (slug) {
          var up = uploads[path] && !uploads[path].done
            ? readB64(uploads[path].file)
              .then(function (b64) { return api("/contents/" + encPath(path), { method: "PUT", body: { message: "Upload picture (shop, new product)", content: b64, branch: BRANCH } }); })
              .then(function () { uploads[path].done = true; })
            : Promise.resolve();
          return up.then(function () {
            // The same starting values as "New" in the admin panel.
            var data = { title_en: titles.title_en, title_he: titles.title_he, visible: true, order: 10 };
            if (cat.value) data.category = cat.value;
            data.type = "physical";
            data.images = [{ image: "/" + path, alt_en: "", alt_he: "" }];
            if (raw) data.price = Number(raw);
            data.currency = "ILS";
            data.ships_to = "worldwide";
            data.price_from = false;
            data.availability = "available";
            data.description_en = ""; data.description_he = "";
            return api("/contents/" + encPath("content/products/" + slug + ".json"), { method: "PUT", body: { message: "New product " + slug + " (added on the shop page)", content: utf8ToB64(JSON.stringify(data, null, 2) + "\n"), branch: BRANCH } });
          }).then(function () { return slug; });
        })
        .then(function (slug) {
          close();
          var here = location.pathname;
          var url = here.replace(/shop\/(index\.html)?$/, "shop/" + slug + "/" + (/index\.html$/.test(here) ? "index.html" : ""));
          var done = el("p", { "class": "pe-note pe-created", "data-created": slug }, [document.createTextNode(T.created + " "), el("a", { href: url, text: T.openProduct })]);
          var w = box.querySelector(".pe-new-product");
          w.parentNode.insertBefore(done, w.nextSibling);
          followSave(lastCommit, "", false);
        })
        .catch(function () { createBtn.disabled = false; msg.textContent = T.errCreate; });
    }
  }

  // ---------- pictures (lists with data-ed-photo) ----------
  // A picture chosen from this computer stays in the browser until "Save";
  // then it is uploaded to assets/uploads/<page>/ before the page's file.
  var uploads = {}; // "assets/uploads/…" → { file, blobUrl, done }
  var PAGE = PRODUCT ? "shop" : FILE.replace(/^content\/|\.json$/g, "");
  function norm(p) { return String(p || "").replace(/^\/+/, ""); }
  function picture(path) {
    var p = norm(path), img = el("img", { alt: "", loading: "lazy", decoding: "async" });
    img.src = uploads[p] ? uploads[p].blobUrl : BASE + p.split("/").map(encodeURIComponent).join("/");
    return img;
  }
  var imageList = null;
  function listImages() {
    if (imageList) return Promise.resolve(imageList);
    var get = function (d) { return api("/contents/" + encPath(d) + ref).catch(function () { return []; }); };
    return Promise.all([get("assets/work"), get("assets/uploads")]).then(function (top) {
      var sub = (Array.isArray(top[1]) ? top[1] : []).filter(function (f) { return f.type === "dir"; }).map(function (f) { return get(f.path); });
      return Promise.all(sub).then(function (more) { return top.concat(more); });
    }).then(function (res) {
      var out = [];
      res.forEach(function (items) { (Array.isArray(items) ? items : []).forEach(function (f) { if (f.type === "file" && /\.(jpe?g|png|webp)$/i.test(f.name)) out.push(f.path); }); });
      Object.keys(uploads).forEach(function (p) { if (out.indexOf(p) < 0) out.unshift(p); });
      imageList = out;
      return out;
    });
  }
  function pickPicture(done) {
    var chosen = "";
    var grid = el("div", { "class": "pe-pick-grid" }, [el("p", { text: T.pickLoading })]);
    var chooseBtn = button(T.choose, function () { if (!chosen) return; close(); done(chosen); }, "pe-btn pe-primary");
    chooseBtn.disabled = true;
    var file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "class": "pe-file" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var safe = f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "picture";
      var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
      var path = "assets/uploads/" + PAGE + "/" + safe + "-" + Date.now().toString(36) + ext;
      uploads[path] = { file: f, blobUrl: URL.createObjectURL(f) };
      if (imageList) imageList.unshift(path);
      choosePath(path); draw();
    });
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.pickTitle }, [
      el("div", { "class": "pe-modal-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.pickTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("label", { "class": "pe-upload" }, [document.createTextNode(T.pickUpload + " "), file, el("span", { "class": "pe-note", text: " " + T.uploadNote })]),
        grid,
        el("div", { "class": "pe-modal-foot" }, [chooseBtn]),
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
        var b = el("button", { type: "button", "class": "pe-pick", "data-path": p, "aria-pressed": String(p === chosen), title: p.split("/").pop(), "aria-label": p.split("/").pop() }, [picture(p)]);
        b.addEventListener("click", function () { choosePath(p); });
        b.addEventListener("dblclick", function () { choosePath(p); chooseBtn.click(); });
        grid.appendChild(b);
      });
    }
    document.body.appendChild(dialog);
    listImages().then(draw);
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
  var watcher = core.siteWatch({ base: BASE, api: api, T: T, status: status, setStatus: setStatus, dirty: dirty, beforeReload: function () { leaving = true; } });
  function watchSite() { watcher.watch(); }
  function followSave(commitSha, note, warn) { watcher.follow(commitSha, note ? " " + note : "", warn ? "warn" : "ok"); }

  // ---------- automatic translation (js/auto-translate.js) ----------
  // Every text changed in this language since loading → its twin in the other
  // language. Names of people (data-ed-notr) are never translated.
  function translateChanges() {
    var orig = JSON.parse(original);
    var notr = new WeakMap();
    lists.forEach(function (L) {
      if (!L.notr.length) return;
      (state.file[L.field] || []).forEach(function (it) { notr.set(it, L.notr.map(function (sub) { return keyOf(L, sub, lang); })); });
    });
    return trReady.then(function () {
      if (!window.BubaTranslate) return { n: 0 };
      return window.BubaTranslate.run([{ now: state.file, before: orig.file }, { now: state.labels, before: orig.labels }], {
        exclude: false,
        skip: function (key, item) { var k = notr.get(item); return !!(k && k.indexOf(key) >= 0); },
        onStart: function (m) { setStatus(m); },
      });
    }).catch(function () { return { n: 0, failed: true }; });
  }

  // ---------- save ----------
  function save() {
    lastCommit = "";
    if (!dirty()) return;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    saveBtn.disabled = true;
    // A person's name without a name in the other language keeps the same name there.
    lists.forEach(function (L) {
      (state.file[L.field] || []).forEach(function (it) {
        L.notr.forEach(function (sub) { var v = it[keyOf(L, sub, lang)], ko = keyOf(L, sub, other); if (v && !it[ko]) it[ko] = v; });
      });
    });
    translateChanges().then(function (tr) { write(tr); });
  }
  function write(tr) {
    var note = tr.failed ? T.trFail : tr.n ? T.trDone.replace("{n}", tr.n) : "";
    giveSlugs();
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
        // Pictures chosen from this computer that the page now uses go up first.
        var used = {};
        lists.forEach(function (L) { if (L.photo) (state.file[L.field] || []).forEach(function (it) { var p = norm(it[L.photo]); if (uploads[p] && !uploads[p].done) used[p] = true; }); });
        Object.keys(used).forEach(function (path) {
          chain = chain.then(function () { return readB64(uploads[path].file); })
            .then(function (b64) { return api("/contents/" + encPath(path), { method: "PUT", body: { message: "Upload picture (" + PAGE + " page, edited on the page)", content: b64, branch: BRANCH } }); })
            .then(function () { uploads[path].done = true; });
        });
        jobs.forEach(function (j) {
          chain = chain.then(function () {
            var body = { message: j.message, content: utf8ToB64(JSON.stringify(j.data, null, 2) + "\n"), branch: BRANCH };
            if (j.get()) body.sha = j.get();
            return api("/contents/" + encPath(j.path), { method: "PUT", body: body }).then(function (res) { j.set(res.content.sha); wrote++; });
          });
        });
        // The text styles last (only when they changed).
        return chain.then(function () { return window.BubaStyle ? window.BubaStyle.save(PAGE) : ""; }).then(function (c) { if (c) { lastCommit = c; wrote++; } });
      })
      .then(function () { original = snap(); saveBtn.disabled = true; followSave(lastCommit, note, tr.failed); })
      .catch(function (err) {
        saveBtn.disabled = false;
        if (wrote) { setStatus(T.errPartial, "error"); return; }
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    leaving = true;
    location.reload();
  }
})();

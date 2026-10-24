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
    photoAdd: "Add a picture", photoChange: "Replace the picture", photoRemove: "Remove the picture", photoRemoved: "Picture removed. You can undo it.",
    pickTitle: "Choose a picture", pickLoading: "Loading pictures…", pickUpload: "Upload from your computer or phone:", uploadNote: "(saved on the site only when you press \"Save\")",
    choose: "Choose", close: "Close", newBadge: "New — saved when you save",
    bodyHint2: "Text (click to write; Enter = new line, an empty line = new paragraph)",
    hint_email: "Email address (click to write)", hint_email_2: "Another email (optional)", hint_phone: "Phone or WhatsApp (optional)", hint_location: "Area (optional), e.g. North and all of Israel",
    badEmail: "That is not a valid email address. The previous address was kept.", badPhone: "A phone number can have digits, spaces, dashes, brackets and a + at the start. The previous number was kept.",
    plainNote: "Email and phone are the same in both languages. They also show at the bottom of every page and in shop orders.",
    hint_role: "Role (click to write)", hint_bio: "A few lines about them (click to write)",
    nameShared: "A person's name is not translated. If there is no name in the other language, the same name is saved there.",
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
      if (!state.labels[key]) { node.textContent = usual; setStatus(T.emptyBack, "warn"); }
    });
    if (node.tagName === "H1") node.parentNode.insertBefore(el("p", { "class": "pe-note pe-title-note", text: T.titleNote }), node.nextSibling);
  }
  function fill() { parts.forEach(function (p) { if (document.activeElement !== p.node) p.node.textContent = p.get(); }); }

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
      if (head && "intro_" + lang in state.file) head.appendChild(el("p", { "class": "lede", "data-ed": "intro" }));
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed]"), function (n) { if (!n.closest("[data-ed-list]")) fieldPart(n); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ed-list]"), function (n) {
      var tpl = n.querySelector("[data-ed-item]");
      var words = function (a) { return (n.getAttribute(a) || "").split(",").filter(Boolean); };
      lists.push({ node: n, field: n.getAttribute("data-ed-list"), subs: (n.getAttribute("data-ed-subs") || "name").split(","), tpl: tpl ? tpl.cloneNode(true) : el("li"),
        tags: words("data-ed-tags"), bare: words("data-ed-bare-en"), notr: words("data-ed-notr"), photo: n.getAttribute("data-ed-photo") || "" });
    });
    var hd = box.querySelector(".page-head");
    if (hd) hd.parentNode.insertBefore(el("p", { "class": "pe-note pe-proj-note", text: T.langNote }), hd.nextSibling);
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
          if (!n) { n = tagFor(L, k); n.setAttribute("data-ed-sub", sub); li.appendChild(n); }
          var key = keyOf(L, sub, lang);
          n.textContent = it[key] || "";
          var shared = L.notr.indexOf(sub) >= 0;
          editable(n, T["hint_" + sub] || (k === 0 ? T.nameHint : T.bodyHint), function (v) { it[key] = v; }, function () { if (k === 0 && !it[key]) setStatus(T.nameEmpty, "warn"); else if (shared && it[key] && !it[keyOf(L, sub, other)]) setStatus(T.nameShared); });
        });
        if (!it[keyOf(L, L.subs[0], lang)]) li.appendChild(el("span", { "class": "pe-missing", text: T.notShown }));
        var tools = [
          button(T.prevBtn, function () { move(L, i, -1); }, "pe-btn pe-move", T.earlier),
          button(T.remove, function () { items.splice(i, 1); changed(); setStatus(T.removed, "warn"); }, "pe-btn pe-danger"),
          button(T.nextBtn, function () { move(L, i, 1); }, "pe-btn pe-move", T.later),
        ];
        if (L.photo) {
          tools.push(button(it[L.photo] ? T.photoChange : T.photoAdd, function () {
            pickPicture(function (path) { it[L.photo] = "/" + path; changed(); });
          }, "pe-btn"));
          if (it[L.photo]) tools.push(button(T.photoRemove, function () { it[L.photo] = ""; changed(); setStatus(T.photoRemoved, "warn"); }, "pe-btn"));
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
        addBox = el("div", { "class": "pe-add" }, [button("+ " + T.add, function () {
          var blank = {};
          L.subs.forEach(function (sub) { blank[keyOf(L, sub, "he")] = ""; blank[keyOf(L, sub, "en")] = ""; });
          if (L.photo) blank[L.photo] = "";
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

  // ---------- pictures (lists with data-ed-photo) ----------
  // A picture chosen from this computer stays in the browser until "Save";
  // then it is uploaded to assets/uploads/<page>/ before the page's file.
  var uploads = {}; // "assets/uploads/…" → { file, blobUrl, done }
  var PAGE = FILE.replace(/^content\/|\.json$/g, "");
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
  function readB64(f) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(f);
    });
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
    // Several paragraphs: each is translated on its own, so the paragraphs stay.
    var paras = String(text).split(/\n{2,}/);
    if (paras.length > 1) {
      var seq = Promise.resolve([]);
      paras.forEach(function (p) { seq = seq.then(function (done) { return translate(p).then(function (t) { return done.concat(t); }); }); });
      return seq.then(function (list) { var t = list.join("\n\n"); trCache[text] = t; return t; });
    }
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
          var k = keyOf(L, sub, lang), ko = keyOf(L, sub, other), v = it[k];
          if (L.notr.indexOf(sub) >= 0) return;
          // Unchanged texts (also after moving items around) are found among the texts loaded from the file.
          if (!v || was.some(function (o) { return o[k] === v; })) return;
          jobs.push({ text: v, put: function (t) { it[ko] = t; } });
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

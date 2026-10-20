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
(function () {
  "use strict";
  if (window.__bubapixPageEditor) return;
  window.__bubapixPageEditor = true;

  var launcher = document.querySelector("[data-page-editor]");
  if (!launcher) return;
  var REPO = launcher.getAttribute("data-repo");
  var BRANCH = launcher.getAttribute("data-branch");
  var FILE = "content/site.json";
  var API = "https://api.github.com/repos/" + REPO;
  var lang = document.documentElement.lang === "he" ? "he" : "en";
  var he = lang === "he";

  var T = he ? {
    title: "עריכה על הדף",
    loading: "טוען את הגדרות הדף…",
    save: "שמירה",
    saving: "שומר…",
    cancel: "יציאה בלי לשמור",
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
    earlier: "הזזה אחורה", later: "הזזה קדימה", drag: "גררו כדי להזיז",
    replace: "החלפה", hide: "הסתרה", show: "הצגה", remove: "הסרה מהגלריה",
    add: "הוספת תמונה לגלריה",
    hiddenTitle: "תמונות מוסתרות (נשמרות, לא מוצגות)",
    elsewhereTitle: "מוצגות במקום אחר בדף (פתיחה או שורת הפוסטרים), ולכן לא בגלריה",
    replaceHero: "החלפת תמונת הפתיחה",
    replaceFeature: "החלפת התמונה השנייה",
    removeFeature: "הסרת התמונה השנייה",
    addFeature: "הוספת תמונה שנייה",
    taglineHint: "לחצו על המשפט כדי לערוך אותו",
    pickTitle: "בחירת תמונה",
    pickUpload: "העלאה מהמחשב",
    pickLoading: "טוען תמונות…",
    altHe: "תיאור התמונה לעיוורים, עברית (רשות)",
    altEn: "תיאור התמונה לעיוורים, אנגלית (רשות)",
    altNote: "התיאור הקודם נמחק כי התמונה התחלפה. כתבו תיאור למה שרואים בתמונה.",
    choose: "בחירה",
    signIn: "כדי לערוך צריך להיכנס פעם אחת לכלי הניהול בדפדפן הזה (״כל הניהול״ ← ״כניסה לעריכת תוכן״), ואז לחזור לכאן.",
    openManage: "לכלי הניהול",
    errLoad: "לא הצלחתי לטעון את הגדרות הדף מ־GitHub.",
    errSave: "השמירה נכשלה. שום דבר לא השתנה.",
    errChanged: "הגדרות הדף השתנו בינתיים במקום אחר (למשל בכלי הניהול). כדי לא למחוק את השינוי ההוא, לא שמרתי. צאו מהעריכה, רעננו את הדף ונסו שוב.",
    errAuth: "הכניסה פגה או שאין הרשאה. היכנסו מחדש לכלי הניהול ונסו שוב.",
    leave: "יש שינויים שלא נשמרו. לצאת בכל זאת?",
    newBadge: "חדשה",
    project: "פרויקט",
    noProject: "ללא פרויקט",
    projectHint: "לחיצה על התמונה תפתח את דף הפרויקט שתבחרו",
    toPage: "להוסיף את התמונה גם לגלריה בדף הפרויקט",
    pickProject: "שיוך לפרויקט (רשות, לפי בחירתכם)",
  } : {
    title: "Edit on the page",
    loading: "Loading the page settings…",
    save: "Save",
    saving: "Saving…",
    cancel: "Leave without saving",
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
    earlier: "Move earlier", later: "Move later", drag: "Drag to move",
    replace: "Replace", hide: "Hide", show: "Show", remove: "Remove from gallery",
    add: "Add a picture to the gallery",
    hiddenTitle: "Hidden pictures (kept, not shown)",
    elsewhereTitle: "Shown elsewhere on the page (opening or posters row), so not in the gallery",
    replaceHero: "Replace the opening image",
    replaceFeature: "Replace the second picture",
    removeFeature: "Remove the second picture",
    addFeature: "Add a second picture",
    taglineHint: "Click the sentence to edit it",
    pickTitle: "Choose a picture",
    pickUpload: "Upload from this computer",
    pickLoading: "Loading pictures…",
    altHe: "Description for blind visitors, Hebrew (optional)",
    altEn: "Description for blind visitors, English (optional)",
    altNote: "The old description was cleared because the picture changed. Describe what the picture shows.",
    choose: "Choose",
    signIn: "To edit, sign in once to the admin panel in this browser (\"Manage\" → content editing), then come back here.",
    openManage: "Open the admin panel",
    errLoad: "Could not load the page settings from GitHub.",
    errSave: "Saving failed. Nothing was changed.",
    errChanged: "The page settings were changed elsewhere in the meantime (for example in the admin panel). To keep that change, nothing was saved. Leave editing, reload the page and try again.",
    errAuth: "The sign-in expired or has no permission. Sign in to the admin panel again and retry.",
    leave: "There are unsaved changes. Leave anyway?",
    newBadge: "new",
    project: "Project",
    noProject: "No project",
    projectHint: "Clicking the picture opens the project page you choose",
    toPage: "Also add the picture to the gallery on the project page",
    pickProject: "Project (optional, your choice)",
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
          return data;
        });
      });
  }
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
  var pageAdds = {}; // project slug -> pictures to add to that project's page gallery
  var hasPageAdds = function () { return Object.keys(pageAdds).some(function (k) { return pageAdds[k].length; }); };
  var dirty = function () { return data && (JSON.stringify(data) !== original || hasPageAdds()); };
  var projectName = function (slug) { var p = projects.filter(function (x) { return x.slug === slug; })[0]; return p ? p.name : slug; };
  function loadProjects() {
    return api("/contents/content/projects?ref=" + encodeURIComponent(BRANCH))
      .then(function (items) {
        var files = (Array.isArray(items) ? items : []).filter(function (f) { return f.type === "file" && /\.json$/.test(f.name); });
        return Promise.all(files.map(function (f) {
          return api("/contents/" + encPath(f.path) + "?ref=" + encodeURIComponent(BRANCH)).then(function (res) {
            var d = {};
            try { d = JSON.parse(b64ToUtf8(res.content)); } catch (e) { d = {}; }
            var slug = f.name.replace(/\.json$/, "");
            return { slug: slug, name: (he ? d.title_he || d.title_en : d.title_en || d.title_he) || slug, order: Number(d.order) || 99 };
          });
        }));
      })
      .then(function (list) { projects = list.sort(function (a, b) { return a.order - b.order; }); })
      .catch(function () { projects = []; });
  }
  function projectSelect(value, onChange) {
    var opts = [["", T.project + ": " + T.noProject]].concat(projects.map(function (p) { return [p.slug, T.project + ": " + p.name]; }));
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
  var bar = el("div", { "class": "pe-bar", role: "region", "aria-label": T.title }, [
    el("strong", { "class": "pe-bar-title", text: T.title }),
    el("span", { "class": "pe-bar-layout" }),
    status,
    el("span", { "class": "pe-bar-actions" }, [saveBtn, button(T.cancel, quit, "pe-btn pe-ghost")]),
  ]);
  document.body.insertBefore(bar, document.body.firstChild);
  document.documentElement.classList.add("page-editing");
  setStatus(T.loading);

  function setStatus(text, kind) {
    status.textContent = text || "";
    status.className = "pe-status" + (kind ? " is-" + kind : "");
  }
  function refreshStatus() {
    setStatus(dirty() ? T.unsaved : T.noChanges, dirty() ? "warn" : "");
    saveBtn.disabled = !dirty();
  }
  function changed() { render(); refreshStatus(); }

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
      return loadProjects();
    })
    .then(function () {
      start();
      refreshStatus();
    })
    .catch(function (err) {
      setStatus(err.status === 401 || err.status === 403 ? T.errAuth : T.errLoad, "error");
      saveBtn.disabled = true;
    });

  window.addEventListener("beforeunload", function (e) {
    if (dirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- page parts ----------
  var workSection = document.querySelector(".section-work");
  var mosaic = document.querySelector("[data-mosaic]");
  var editArea = el("div", { "class": "pe-area" });
  var opening = document.querySelector(".opening");

  function start() {
    // Layout choices in the toolbar.
    var lay = bar.querySelector(".pe-bar-layout");
    lay.appendChild(select(T.perRow, data.gallery_columns || "mixed",
      [["mixed", T.mixed], ["2", "2"], ["3", "3"], ["4", "4"]].map(function (o, i) { return i ? [o[0], o[1] + " " + T.perRow] : [o[0], T.mixed + " " + T.perRow]; }),
      function (v) { data.gallery_columns = v; changed(); }));
    lay.appendChild(select(T.perRowPhone, data.gallery_phone || "mixed",
      [["mixed", T.mixed + " " + T.perRowPhone], ["1", "1 " + T.perRowPhone], ["2", "2 " + T.perRowPhone]],
      function (v) { data.gallery_phone = v; changed(); }));
    lay.appendChild(select(T.gap, data.gallery_gap || "minimal",
      [["none", T.gap + ": " + T.gapNone], ["minimal", T.gap + ": " + T.gapMin], ["small", T.gap + ": " + T.gapSmall], ["medium", T.gap + ": " + T.gapMedium]],
      function (v) { data.gallery_gap = v; changed(); }));

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
    render();
  }

  // ---------- opening: two pictures and the sentence ----------
  function setupOpening() {
    if (!opening) return;
    var heroBox = opening.querySelector(".opening-hero");
    var featureBox = opening.querySelector(".opening-feature");
    if (heroBox) {
      heroBox.classList.add("pe-holder");
      heroBox.appendChild(el("div", { "class": "pe-tools pe-tools-top" }, [
        button(T.replaceHero, function () {
          pick(function (path, alts, choice) {
            addToPage(choice.toPage && choice.project, path, alts);
            data.hero_image = "/" + path;
            data.hero_alt_he = alts.he; data.hero_alt_en = alts.en;
            swapImg(heroBox, path); changed();
          });
        }),
      ]));
    }
    var featureTools = el("div", { "class": "pe-tools pe-tools-top" });
    function drawFeatureTools() {
      featureTools.textContent = "";
      featureTools.appendChild(button(data.feature_image ? T.replaceFeature : T.addFeature, function () {
        pick(function (path, alts, choice) {
          addToPage(choice.toPage && choice.project, path, alts);
          data.feature_project = choice.project || "";
          data.feature_image = "/" + path;
          data.feature_alt_he = alts.he; data.feature_alt_en = alts.en;
          if (featureBox) { featureBox.hidden = false; swapImg(featureBox, path); }
          drawFeatureTools(); changed();
        });
      }));
      if (data.feature_image) featureTools.appendChild(button(T.removeFeature, function () {
        data.feature_image = ""; data.feature_alt_he = ""; data.feature_alt_en = "";
        if (featureBox) featureBox.hidden = true;
        drawFeatureTools(); changed();
      }, "pe-btn pe-danger"));
    }
    if (!featureBox) {
      featureBox = el("div", { "class": "opening-feature", hidden: "" }, [el("figure", { "class": "jg-item" }, [el("span", { "class": "jg-media" })])]);
      opening.insertBefore(featureBox, opening.querySelector(".opening-tagline"));
    }
    featureBox.classList.add("pe-holder");
    (data.feature_image ? featureBox : opening).appendChild(featureTools);
    drawFeatureTools();

    var tagline = opening.querySelector(".opening-tagline") || document.querySelector(".tagline");
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
    }
    // In editing, clicking a picture must not leave the page.
    opening.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a.jg-item") && !e.target.closest(".pe-tools")) e.preventDefault();
    }, true);
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
      if (count === 1 && list[i].r < 1.3) count = 2;
      count = Math.min(count, maxPer);
      var row = [], sum = 0;
      while (i < list.length && (row.length < count || (count > 1 && sum < minSum && row.length < maxPer))) {
        row.push(i); sum += list[i].r; i++;
      }
      out.push(row);
    }
    return out;
  }
  var phone = window.matchMedia("(max-width: 700px)");
  if (phone.addEventListener) phone.addEventListener("change", function () { if (data) render(); });

  var dragFrom = -1;
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

    var cols = Number(data.gallery_columns) || 0, ph = Number(data.gallery_phone) || 0;
    var rows = phone.matches
      ? (ph ? buildRows(shown, [ph], 1.4, ph, false, !heroP) : buildRows(shown, [2, 1, 2, 2], 1.4, 2, false, !heroP))
      : (cols ? buildRows(shown, [cols], 2.3, cols, true, !heroP) : buildRows(shown, [2, 3, 1, 3, 2, 4], 2.3, 5, true, !heroP));

    var gapCls = ["none", "small", "medium"].indexOf(data.gallery_gap) >= 0 ? " gap-" + data.gallery_gap : "";
    var box = el("div", { "class": "mosaic pe-mosaic" + gapCls });
    rows.forEach(function (row) {
      var r = el("div", { "class": "mrow n" + row.length });
      row.forEach(function (n) { r.appendChild(cell(shown[n])); });
      box.appendChild(r);
    });
    editArea.appendChild(box);
    editArea.appendChild(el("div", { "class": "pe-add" }, [button("+ " + T.add, function () {
      pick(function (path, alts, choice) {
        addToPage(choice.toPage && choice.project, path, alts);
        data.gallery.push({ image: "/" + path, visible: true, size: "auto", link: "", project: choice.project || "", alt_en: alts.en, alt_he: alts.he, title_en: "", title_he: "", note_en: "", note_he: "", caption: "hidden", frame: "natural", focus: "center" });
        changed();
      });
    }, "pe-btn pe-primary")]));
    if (hidden.length) editArea.appendChild(strip(T.hiddenTitle, hidden, true));
    if (elsewhere.length) editArea.appendChild(strip(T.elsewhereTitle, elsewhere, false));
  }

  function cell(item) {
    var g = item.g, idx = item.idx;
    var media = el("span", { "class": "jg-media" }, [picture(g.image, "30vw", render)]);
    media.style.aspectRatio = String(item.r);
    var fig = el("figure", { "class": "jg-item pe-item" + (FRAMES[g.frame] ? " fit-cover focus-" + (g.focus || "center") : ""), draggable: "true", "data-idx": String(idx), title: T.drag }, [media]);
    fig.style.flexGrow = String(Math.round(item.r * 100));
    if (uploads[norm(g.image)]) fig.appendChild(el("span", { "class": "pe-badge", text: T.newBadge }));
    // Arrow shapes follow the reading direction: "earlier" points right in Hebrew.
    var back = he ? "›" : "‹", fwd = he ? "‹" : "›";
    fig.appendChild(el("div", { "class": "pe-tools" }, [
      button(back, function () { move(idx, -1); }, "pe-icon", T.earlier),
      select(T.size, g.size || "auto", [["auto", T.size + ": " + T.sizeAuto], ["large", T.size + ": " + T.sizeLarge], ["medium", T.size + ": " + T.sizeMedium], ["small", T.size + ": " + T.sizeSmall]],
        function (v) { g.size = v; changed(); }),
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
      button(T.hide, function () { g.visible = false; changed(); }),
      button(fwd, function () { move(idx, 1); }, "pe-icon", T.later),
    ]));
    fig.addEventListener("dragstart", function (e) { dragFrom = idx; fig.classList.add("is-dragging"); try { e.dataTransfer.setData("text/plain", String(idx)); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* old browser */ } });
    fig.addEventListener("dragend", function () { fig.classList.remove("is-dragging"); dragFrom = -1; });
    fig.addEventListener("dragover", function (e) { if (dragFrom >= 0 && dragFrom !== idx) { e.preventDefault(); fig.classList.add("is-target"); } });
    fig.addEventListener("dragleave", function () { fig.classList.remove("is-target"); });
    fig.addEventListener("drop", function (e) {
      e.preventDefault(); fig.classList.remove("is-target");
      if (dragFrom < 0 || dragFrom === idx) return;
      var rect = fig.getBoundingClientRect();
      var afterTarget = he ? e.clientX < rect.left + rect.width / 2 : e.clientX > rect.left + rect.width / 2;
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
    var dirs = ["assets/work", "assets/uploads"].concat(projects.map(function (p) { return "assets/uploads/" + p.slug; }));
    return Promise.all(dirs.map(function (d) {
      return api("/contents/" + encPath(d) + "?ref=" + encodeURIComponent(BRANCH)).catch(function () { return []; });
    })).then(function (res) {
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
  function pick(done, currentProject) {
    var chosen = "";
    var proj = projectSelect(currentProject || "", function () { toPage.disabled = !proj.value; if (!proj.value) toPage.checked = false; });
    proj.classList.add("pe-input");
    var toPage = el("input", { type: "checkbox" });
    toPage.disabled = !proj.value;
    var grid = el("div", { "class": "pe-pick-grid" }, [el("p", { text: T.pickLoading })]);
    var altHe = el("input", { type: "text", dir: "rtl", "class": "pe-input" });
    var altEn = el("input", { type: "text", dir: "ltr", "class": "pe-input" });
    var chooseBtn = button(T.choose, function () {
      if (!chosen) return;
      close();
      // A picture uploaded now is stored in the chosen project's folder.
      if (uploads[chosen] && !uploads[chosen].done && proj.value && chosen.indexOf("assets/uploads/" + proj.value + "/") !== 0) {
        var moved = chosen.replace(/^assets\/uploads\//, "assets/uploads/" + proj.value + "/");
        uploads[moved] = uploads[chosen]; delete uploads[chosen];
        if (imageList) imageList = imageList.map(function (p) { return p === chosen ? moved : p; });
        chosen = moved;
      }
      done(chosen, { he: altHe.value.trim(), en: altEn.value.trim() }, { project: proj.value, toPage: toPage.checked });
    }, "pe-btn pe-primary");
    chooseBtn.disabled = true;
    var file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "class": "pe-file" });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var safe = f.name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "picture";
      var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase();
      var path = "assets/uploads/" + safe + "-" + Date.now().toString(36) + ext;
      uploads[path] = { file: f, blobUrl: URL.createObjectURL(f) };
      if (imageList) imageList.unshift(path);
      choose(path);
      draw();
    });
    var dialog = el("div", { "class": "pe-modal", role: "dialog", "aria-modal": "true", "aria-label": T.pickTitle }, [
      el("div", { "class": "pe-modal-box" }, [
        el("div", { "class": "pe-modal-head" }, [el("strong", { text: T.pickTitle }), button(T.close, function () { close(); }, "pe-btn pe-ghost")]),
        el("label", { "class": "pe-upload" }, [document.createTextNode(T.pickUpload + " "), file]),
        grid,
        el("div", { "class": "pe-modal-foot" }, [
          el("p", { "class": "pe-note", text: T.altNote }),
          el("label", {}, [document.createTextNode(T.altHe), altHe]),
          el("label", {}, [document.createTextNode(T.altEn), altEn]),
          el("label", {}, [document.createTextNode(T.pickProject), proj]),
          el("label", { "class": "pe-check" }, [toPage, document.createTextNode(" " + T.toPage)]),
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

  // ---------- save ----------
  function save() {
    if (!dirty()) return;
    saveBtn.disabled = true;
    setStatus(T.saving);
    var used = {};
    var all = [data.hero_image, data.feature_image].concat(data.gallery.map(function (g) { return g && g.image; }));
    all.forEach(function (p) { var u = uploads[norm(p)]; if (u && !u.done) used[norm(p)] = true; });
    var chain = Promise.resolve();
    Object.keys(used).forEach(function (p) {
      chain = chain.then(function () { return readB64(uploads[p].file); })
        .then(function (b64) { return api("/contents/" + encPath(p), { method: "PUT", body: { message: "Upload picture (homepage, edited on the page)", content: b64, branch: BRANCH } }); })
        // Keep showing the picture from this computer until the site is rebuilt.
        .then(function () { uploads[p].done = true; });
    });
    chain
      .then(function () { return api("/contents/" + encPath(FILE) + "?ref=" + encodeURIComponent(BRANCH)); })
      .then(function (cur) {
        if (cur.sha !== sha) { var err = new Error("changed"); err.changed = true; throw err; }
        if (JSON.stringify(data) === original) return { content: { sha: sha } };
        return api("/contents/" + encPath(FILE), { method: "PUT", body: { message: "Homepage: edited on the page", content: utf8ToB64(JSON.stringify(data, null, 2) + "\n"), sha: sha, branch: BRANCH } });
      })
      .then(function (res) {
        sha = res.content.sha;
        original = JSON.stringify(data);
        return savePageAdds();
      })
      .then(function () {
        saveBtn.disabled = true;
        setStatus(T.saved, "ok");
        render();
      })
      .catch(function (err) {
        saveBtn.disabled = false;
        setStatus(err.changed || err.status === 409 ? T.errChanged : err.status === 401 || err.status === 403 ? T.errAuth : T.errSave, "error");
      });
  }
  // Adds the chosen pictures to each project's page gallery (its first
  // gallery section, or a new one), keeping everything else in the file.
  function savePageAdds() {
    var chain = Promise.resolve();
    Object.keys(pageAdds).forEach(function (slug) {
      var adds = pageAdds[slug];
      if (!adds.length) return;
      var path = "content/projects/" + slug + ".json";
      chain = chain
        .then(function () { return api("/contents/" + encPath(path) + "?ref=" + encodeURIComponent(BRANCH)); })
        .then(function (res) {
          var d = JSON.parse(b64ToUtf8(res.content));
          if (!Array.isArray(d.sections)) d.sections = [];
          var sec = d.sections.filter(function (x) { return x && x.type === "gallery"; })[0];
          if (!sec) { sec = { type: "gallery", hidden: false, heading_en: "", heading_he: "", images: [] }; d.sections.push(sec); }
          if (!Array.isArray(sec.images)) sec.images = [];
          adds.forEach(function (a) {
            if (sec.images.some(function (x) { return x && x.image === a.image; })) return;
            sec.images.push({ image: a.image, link: "", alt_en: a.alt_en, alt_he: a.alt_he, title_en: "", title_he: "", note_en: "", note_he: "", caption: "hidden", on_home: false, frame: "natural", focus: "center" });
          });
          return api("/contents/" + encPath(path), { method: "PUT", body: { message: "Project " + slug + ": picture added (edited on the homepage)", content: utf8ToB64(JSON.stringify(d, null, 2) + "\n"), sha: res.sha, branch: BRANCH } });
        })
        .then(function () { pageAdds[slug] = []; });
    });
    return chain;
  }
  function readB64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  function quit() {
    if (dirty() && !window.confirm(T.leave)) return;
    original = JSON.stringify(data); // allow leaving without the browser's own warning
    location.reload();
  }
})();

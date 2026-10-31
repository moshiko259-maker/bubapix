/*
 * BubaPix: free automatic translation for the on-page editors (owner only).
 *
 * Loaded by the editors of the homepage, the projects page and the project
 * pages; never by visitors. On saving, every text the owner changed in the
 * page's language (fields ending _he / _en) is translated into the other
 * language with MyMemory (free, no account, no key) and replaces it there.
 * Not translated: project names (title_*), and texts whose twin in the other
 * language was also changed by hand in the same session. With topOnly, only
 * the file's own title_* is left alone (a video's title inside it is
 * translated).
 */
(function () {
  "use strict";
  if (window.BubaTranslate) return;
  var API = "https://api.mymemory.translated.net/get";

  function bytes(t) { return new TextEncoder().encode(t).length; }
  // The service takes up to 500 bytes at a time (a Hebrew letter is 2 bytes): split by sentences, then by words.
  function chunks(text) {
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
  // Only the entities the service sends back (&amp;, &#39; …) become characters:
  // text between < and > is kept as written.
  function decode(t) { var a = document.createElement("textarea"); a.innerHTML = String(t).replace(/</g, "&lt;"); return a.value; }
  function clean(t) { return String(t || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
  var cache = {};
  function translate(text, from, to) {
    var key = from + "|" + to + "|" + text;
    if (cache[key]) return Promise.resolve(cache[key]);
    // Several paragraphs: each is translated on its own, so the paragraphs stay.
    var paras = String(text).split(/\n{2,}/).filter(function (p) { return p.trim(); });
    if (paras.length > 1) {
      var seq = Promise.resolve([]);
      paras.forEach(function (p) { seq = seq.then(function (done) { return translate(p, from, to).then(function (t) { return done.concat(t); }); }); });
      return seq.then(function (list) { var t = list.join("\n\n"); cache[key] = t; return t; });
    }
    // Several lines in one paragraph (a line break, or a list): each line on its
    // own, so the lines stay; a list mark ("- ", "1. ") is kept as it is.
    var lines = String(text).split("\n").filter(function (l) { return l.trim(); });
    if (lines.length > 1) {
      var seqL = Promise.resolve([]);
      lines.forEach(function (l) { seqL = seqL.then(function (done) { return translate(l, from, to).then(function (t) { return done.concat(t); }); }); });
      return seqL.then(function (list) { var t = list.join("\n"); cache[key] = t; return t; });
    }
    var mark = /^(\s*(?:[-*•–]|\d{1,3}[.)])\s+)([\s\S]*)$/.exec(String(text));
    if (mark && mark[2].trim()) return translate(mark[2], from, to).then(function (t) { t = mark[1].replace(/^\s+/, "") + t; cache[key] = t; return t; });
    var chain = Promise.resolve([]);
    chunks(text).forEach(function (part) {
      chain = chain.then(function (done) {
        return fetch(API + "?q=" + encodeURIComponent(part) + "&langpair=" + from + "|" + to, { cache: "no-store" })
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
    return chain.then(function (list) { var t = clean(list.join(" ")); cache[key] = t; return t; });
  }

  // Walk the data as it is now, next to the data as it was loaded. Lists may
  // have been reordered, so a text counts as unchanged when any item loaded
  // in the same list had exactly that text.
  function collect(now, before, lang, other, exclude, topOnly, skip) {
    var jobs = [], suffix = "_" + lang;
    function walk(node, cands, depth) {
      Object.keys(node).forEach(function (k) {
        var v = node[k];
        if (typeof v === "string") {
          if (k.slice(-3) !== suffix || !v.trim() || (exclude && exclude.test(k) && !(topOnly && depth > 0)) || (skip && skip(k, node))) return;
          if (cands.some(function (c) { return c && c[k] === v; })) return;
          var twin = k.slice(0, -3) + "_" + other, tw = node[twin];
          // Both languages written by hand now: keep both as written.
          if (tw && !cands.some(function (c) { return c && c[twin] === tw; })) return;
          jobs.push({ text: v, put: function (t) { node[twin] = t; } });
        } else if (Array.isArray(v)) {
          var kids = [];
          cands.forEach(function (c) { if (c && Array.isArray(c[k])) kids = kids.concat(c[k]); });
          v.forEach(function (item) { if (item && typeof item === "object" && !Array.isArray(item)) walk(item, kids, depth + 1); });
        } else if (v && typeof v === "object") {
          walk(v, cands.map(function (c) { return c && c[k]; }).filter(function (c) { return c && typeof c === "object"; }), depth + 1);
        }
      });
    }
    if (now && typeof now === "object") walk(now, before && typeof before === "object" ? [before] : [], 0);
    return jobs;
  }

  var he = document.documentElement.lang === "he";
  var lang = he ? "he" : "en", other = he ? "en" : "he";
  var T = he ? {
    label: "תרגום אוטומטי לאנגלית",
    tip: "בשמירה, כל טקסט ששיניתם כאן מתורגם לאנגלית ומחליף את הטקסט באנגלית (חינם). כבו כשאתם מתקנים תרגום. שמות פרויקטים לא מתורגמים.",
    working: "מתרגם לאנגלית…",
    done: "תורגמו לאנגלית {n} טקסטים. לתיקון — פתחו את הדף באנגלית, וכבו שם את ״תרגום אוטומטי״ לפני השמירה.",
    failed: "התרגום לאנגלית לא הצליח (אולי נגמרה המכסה היומית החינמית, או שאין אינטרנט). העברית נשמרה; האנגלית לא השתנתה.",
  } : {
    label: "Auto-translate to Hebrew",
    tip: "On saving, every text you changed here is translated to Hebrew and replaces the Hebrew text (free). Turn off when you fix a translation. Project names are not translated.",
    working: "Translating to Hebrew…",
    done: "Translated to Hebrew: {n}. To fix it, open the page in Hebrew and turn off \"Auto-translate\" there before saving.",
    failed: "Translating to Hebrew failed (maybe the free daily allowance ran out, or there is no internet). The English is saved; the Hebrew did not change.",
  };
  var KEY = "bubapix-auto-translate-" + lang;
  var box = document.createElement("input");
  box.type = "checkbox";
  box.setAttribute("data-auto-translate", "");
  try { box.checked = localStorage.getItem(KEY) !== "0"; } catch (e) { box.checked = true; }
  box.addEventListener("change", function () { try { localStorage.setItem(KEY, box.checked ? "1" : "0"); } catch (e) { /* storage blocked */ } });

  window.BubaTranslate = {
    T: T,
    // The switch for the editor's toolbar.
    toggle: function () {
      var label = document.createElement("label");
      label.className = "pe-check pe-autotr";
      label.title = T.tip;
      var span = document.createElement("span");
      span.textContent = T.label;
      label.appendChild(box);
      label.appendChild(span);
      return label;
    },
    // pairs: [{ now: object to update, before: the same data as loaded }].
    // All or nothing: when anything fails, nothing is changed.
    run: function (pairs, opts) {
      opts = opts || {};
      if (!box.checked) return Promise.resolve({ n: 0 });
      var jobs = [];
      // exclude: keys never translated (default: project names, title_*); false = none. skip(key, item): more exceptions.
      var exclude = opts.exclude === undefined ? /^title_/ : opts.exclude;
      pairs.forEach(function (p) { jobs = jobs.concat(collect(p.now, p.before, lang, other, exclude, !!opts.topOnly, opts.skip)); });
      if (!jobs.length) return Promise.resolve({ n: 0 });
      if (opts.onStart) opts.onStart(T.working);
      var results = [], chain = Promise.resolve();
      jobs.forEach(function (j) { chain = chain.then(function () { return translate(j.text, lang, other).then(function (t) { results.push(t); }); }); });
      return chain
        .then(function () { jobs.forEach(function (j, i) { j.put(results[i]); }); return { n: jobs.length }; })
        .catch(function () { return { n: 0, failed: true }; });
    },
    note: function (res) { return res.failed ? T.failed : res.n ? T.done.replace("{n}", res.n) : ""; },
    // Is the switch on? And one text into the other language (e.g. a new product's name).
    enabled: function () { return box.checked; },
    translate: function (text) { return translate(text, lang, other); },
  };
})();

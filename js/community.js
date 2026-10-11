// BubaPix: visitor comments, questions, ratings, ideas and private consultations.
//
// Talks to Supabase with the PUBLIC "anon" key only. That key can do no more
// than the database rules allow: send a message for review, read messages the
// studio approved, and rate a project once. All checks are repeated on the
// server; the checks here only give faster feedback.
//
// Security: visitor text is always inserted with textContent, never as HTML.
(function () {
  "use strict";

  var dataEl = document.getElementById("community-data");
  if (!dataEl || !window.fetch) return;
  var cfg;
  try { cfg = JSON.parse(dataEl.textContent); } catch (err) { return; }
  var t = cfg.t;
  var headers = {
    "Content-Type": "application/json",
    apikey: cfg.key,
    Authorization: "Bearer " + cfg.key,
  };

  function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function post(path, body) {
    return fetch(cfg.url + path, { method: "POST", headers: headers, body: JSON.stringify(body), credentials: "omit" })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) { return { status: res.status, json: json }; });
      });
  }
  function rpc(name, args) {
    return post("/rest/v1/rpc/" + name, args || {}).then(function (r) {
      if (r.status !== 200) throw new Error("rpc " + r.status);
      return r.json;
    });
  }
  function send(body) { return post("/functions/v1/community", body); }

  function errorText(r) {
    var code = r && r.json && r.json.error;
    return (code && t.errors[code]) || t.errors.server;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var dateFormat = (function () {
    try { return new Intl.DateTimeFormat(cfg.lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return null; }
  })();
  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : dateFormat ? dateFormat.format(d) : d.toISOString().slice(0, 10);
  }

  // One approved comment, question or idea.
  function renderItem(item) {
    var li = el("li", "comment");
    var meta = el("p", "comment-meta");
    meta.appendChild(el("span", "comment-name", item.display_name));
    if (item.kind === "question") meta.appendChild(el("span", "comment-tag", t.questionTag));
    var time = el("time", "comment-date", formatDate(item.created_at));
    time.setAttribute("datetime", item.created_at);
    meta.appendChild(time);
    if (item.edited) meta.appendChild(el("span", "comment-edited", t.edited));
    li.appendChild(meta);
    li.appendChild(el("p", "comment-body", item.body));
    if (item.reply) {
      var reply = el("div", "comment-reply");
      reply.appendChild(el("p", "comment-reply-label", t.reply));
      reply.appendChild(el("p", "comment-body", item.reply));
      li.appendChild(reply);
    }
    return li;
  }

  function fillList(root, items) {
    var list = root.querySelector("[data-list]");
    var empty = root.querySelector("[data-empty]");
    if (!list) return;
    list.textContent = "";
    (items || []).forEach(function (item) { list.appendChild(renderItem(item)); });
    if (empty) empty.hidden = !!(items && items.length);
  }

  function showListError(root) {
    var empty = root.querySelector("[data-empty]");
    if (empty) { empty.textContent = t.unavailable; empty.hidden = false; }
  }

  // ---- Ratings ------------------------------------------------------------
  function showSummary(root, summary) {
    var out = root.querySelector("[data-rating-summary]");
    if (!out) return;
    if (summary && summary.enough) {
      var avg = Number(summary.average).toLocaleString(cfg.lang === "he" ? "he-IL" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      out.textContent = t.ratingSummary.replace("{avg}", avg).replace("{count}", String(summary.count));
    } else {
      out.textContent = t.ratingNotEnough;
    }
  }

  function setupRating(root, slug) {
    var rate = root.querySelector("[data-rate]");
    var status = root.querySelector("[data-rate-status]");
    var key = "bubapix-rated-" + slug;
    if (!rate) return;
    if (storageGet(key)) { rate.hidden = true; return; }
    var busy = false;
    rate.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".star");
      if (!btn || busy) return;
      busy = true;
      rate.setAttribute("aria-busy", "true");
      status.textContent = t.sending;
      send({ action: "rate", project: slug, stars: Number(btn.getAttribute("data-value")) })
        .then(function (r) {
          if (r.status === 200 && r.json.ok) {
            storageSet(key, "1");
            rate.hidden = true;
            status.textContent = t.rateThanks;
            showSummary(root, r.json.summary);
          } else if (r.json && r.json.error === "already_rated") {
            storageSet(key, "1");
            rate.hidden = true;
            status.textContent = t.errors.already_rated;
          } else {
            status.textContent = errorText(r);
          }
        })
        .catch(function () { status.textContent = t.errors.network; })
        .then(function () { busy = false; rate.removeAttribute("aria-busy"); });
    });
  }

  // ---- Forms --------------------------------------------------------------
  function setupForm(form) {
    var opened = Date.now();
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    var kind = form.getAttribute("data-form");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (button.disabled) return;
      var f = form.elements;
      var chosen = form.querySelector("input[name=kind]:checked") || f.kind;
      var body = {
        action: "submit",
        kind: chosen ? chosen.value : kind,
        lang: cfg.lang,
        name: f.name.value.trim(),
        message: f.message.value.trim(),
        email: f.email.value.trim(),
        website: f.website.value,
        elapsed: Date.now() - opened,
      };
      if (form.getAttribute("data-project")) body.project = form.getAttribute("data-project");
      if (f.publicOk) body.publicOk = f.publicOk.checked;

      // Quick checks before sending (the server checks everything again).
      var problem =
        !body.name || body.message.length < 2 ? "missing" :
        body.name.length > 60 || body.message.length > 2000 ? "too_long" :
        kind === "consult" && !body.email ? "email_required" :
        body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ? "email" :
        (body.message.match(/https?:\/\/|www\./gi) || []).length > 2 ? "links" : "";
      if (problem) {
        status.textContent = t.errors[problem];
        status.className = "form-status is-error";
        return;
      }

      button.disabled = true;
      button.textContent = t.sending;
      status.textContent = "";
      status.className = "form-status";
      send(body)
        .then(function (r) {
          if (r.status === 200 && r.json.ok) {
            form.reset();
            opened = Date.now();
            status.textContent = kind === "idea" ? t.ideaSent : kind === "consult" ? t.consultSent : t.sentPending;
            status.className = "form-status is-ok";
          } else {
            status.textContent = errorText(r);
            status.className = "form-status is-error";
          }
        })
        .catch(function () {
          status.textContent = t.errors.network;
          status.className = "form-status is-error";
        })
        .then(function () {
          button.disabled = false;
          button.textContent = t.send;
        });
    });
  }

  // ---- Start --------------------------------------------------------------
  Array.prototype.forEach.call(document.querySelectorAll("[data-community]"), function (root) {
    root.hidden = false;
    var section = root.closest("[data-project]");
    var slug = section ? section.getAttribute("data-project") : "";
    Array.prototype.forEach.call(root.querySelectorAll("form[data-form]"), setupForm);

    if (slug) {
      setupRating(root, slug);
      rpc("rating_summary", { p_slug: slug }).then(function (s) { showSummary(root, s); }).catch(function () {});
      rpc("public_comments", { p_slug: slug }).then(function (items) { fillList(root, items); }).catch(function () { showListError(root); });
    } else if (root.querySelector('[data-list="ideas"]')) {
      rpc("public_ideas").then(function (items) { fillList(root, items); }).catch(function () { showListError(root); });
    }
  });
})();

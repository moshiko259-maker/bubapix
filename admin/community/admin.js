// BubaPix moderation page: review visitor comments, questions, ideas and
// private consultations; reply, edit, approve, reject, archive or delete;
// see real rating numbers.
//
// Security: this page holds no secret. It uses the public "anon" key and the
// site owner's own Supabase login. The database itself (Row Level Security)
// allows reading and changing submissions only for a confirmed account whose
// email is on the admin list, so anyone else who opens this page sees nothing.
// Visitor text is inserted with textContent only, never as HTML.
(function () {
  "use strict";

  // Refuse to work inside a frame on another site (protects against tricks
  // that hide this page under a fake one). GitHub Pages cannot send the
  // usual header for this, so the page checks for itself.
  if (window.top !== window.self) {
    document.documentElement.textContent = "";
    return;
  }

  var SUPABASE_URL = "https://ouskvcsmcddgdukcofex.supabase.co";
  var ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91c2t2Y3NtY2RkZ2R1a2NvZmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDUxNjAsImV4cCI6MjEwNzMyMTE2MH0.SnJUMrnVZ_XzqBYRJP0DoySp8Fc9qg4BBQA9xQE8giA";

  var KIND = { comment: "תגובה", question: "שאלה", idea: "רעיון", consult: "פנייה פרטית" };
  var $ = function (id) { return document.getElementById(id); };

  if (!window.supabase || !window.supabase.createClient) {
    document.body.appendChild(Object.assign(document.createElement("p"), { className: "box", textContent: "טעינת ספריית הניהול נכשלה. בדקו את החיבור ונסו שוב." }));
    return;
  }
  var sb = window.supabase.createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "bubapix-moderation" },
  });

  var state = { status: "pending", items: [] };
  var dateFormat = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

  function setStatus(text, isError) {
    $("status").textContent = text || "";
    $("status").className = "status" + (isError ? " is-error" : "");
  }

  // ---- Login --------------------------------------------------------------
  function showLogin(message) {
    $("app").hidden = true;
    $("logout").hidden = true;
    $("login").hidden = false;
    $("login-status").textContent = message || "";
  }

  async function enter() {
    var res = await sb.rpc("is_admin");
    if (res.error || res.data !== true) {
      await sb.auth.signOut();
      showLogin("לחשבון הזה אין הרשאת ניהול.");
      return;
    }
    $("login").hidden = true;
    $("app").hidden = false;
    $("logout").hidden = false;
    refresh();
  }

  $("login-form").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var f = ev.target.elements;
    $("login-status").textContent = "נכנסים…";
    var res = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    f.password.value = "";
    if (res.error) { $("login-status").textContent = "הכניסה נכשלה. בדקו מייל וסיסמה."; return; }
    enter();
  });

  $("logout").addEventListener("click", async function () {
    await sb.auth.signOut();
    state.items = [];
    $("items").textContent = "";
    showLogin("יצאתם מהמערכת.");
  });

  // ---- Lists --------------------------------------------------------------
  async function loadCounts() {
    var tabs = document.querySelectorAll(".tab[data-status]");
    await Promise.all(Array.prototype.map.call(tabs, async function (tab) {
      var s = tab.getAttribute("data-status");
      if (s === "ratings") return;
      var res = await sb.from("submissions").select("id", { count: "exact", head: true }).eq("status", s);
      tab.querySelector(".count").textContent = res.error ? "" : "(" + res.count + ")";
    }));
  }

  async function loadItems() {
    setStatus("טוען…");
    var q = sb.from("submissions")
      .select("id, created_at, kind, project_slug, lang, display_name, body, public_ok, status, reply, replied_at, edited, moderated_at, submission_contacts(email)")
      .eq("status", state.status)
      .order("created_at", { ascending: false })
      .limit(500);
    var kind = $("kind").value;
    if (kind) q = q.eq("kind", kind);
    var res = await q;
    if (res.error) { setStatus("הטעינה נכשלה: " + res.error.message, true); return; }
    state.items = res.data || [];
    render();
  }

  function emailOf(item) {
    var c = item.submission_contacts;
    if (Array.isArray(c)) c = c[0];
    return c && c.email ? c.email : "";
  }

  function render() {
    var term = $("search").value.trim().toLowerCase();
    var list = $("items");
    list.textContent = "";
    var shown = state.items.filter(function (it) {
      if (!term) return true;
      return [it.display_name, it.body, it.reply, it.project_slug, emailOf(it)].some(function (v) {
        return v && String(v).toLowerCase().indexOf(term) !== -1;
      });
    });
    shown.forEach(function (it) { list.appendChild(renderItem(it)); });
    setStatus(shown.length ? "" : "אין פריטים להצגה.");
  }

  function renderItem(it) {
    var node = $("item-template").content.firstElementChild.cloneNode(true);
    var q = function (sel) { return node.querySelector(sel); };
    q(".kind").textContent = KIND[it.kind] || it.kind;
    q(".kind").classList.add("kind-" + it.kind);
    q(".project").textContent = it.project_slug ? "פרויקט: " + it.project_slug : "";
    q(".lang").textContent = it.lang === "he" ? "עברית" : "English";
    q(".date").textContent = dateFormat.format(new Date(it.created_at));
    q(".date").setAttribute("datetime", it.created_at);
    q(".name").textContent = it.display_name;
    q(".body").textContent = it.body;
    q(".edited").hidden = !it.edited;
    if (it.kind === "idea") {
      q(".consent").hidden = !it.public_ok;
      q(".private").hidden = !!it.public_ok;
    }
    if (it.kind === "consult") q(".private").hidden = false;

    var email = emailOf(it);
    if (email) {
      q(".email").hidden = false;
      var a = q(".email a");
      a.textContent = email;
      a.href = "mailto:" + encodeURIComponent(email).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("BubaPix");
    }
    if (it.reply) {
      q(".reply").hidden = false;
      q(".reply span").textContent = it.reply;
    }

    // Which actions make sense for this item.
    var canPublish = it.kind === "comment" || it.kind === "question" || (it.kind === "idea" && it.public_ok);
    node.querySelectorAll("[data-act]").forEach(function (btn) {
      var act = btn.getAttribute("data-act");
      if (act === it.status) btn.hidden = true;
      if (act === "approved" && !canPublish) btn.hidden = true;
      if (act === "reply" && it.kind === "consult") btn.hidden = true; // private: answer by email
    });
    var note = q(".note");
    if (it.kind === "consult") note.textContent = "פנייה פרטית: לעולם לא מתפרסמת באתר. עונים במייל.";
    else if (it.kind === "idea" && !it.public_ok) note.textContent = "השולח/ת לא אישר/ה פרסום, ולכן אי אפשר לפרסם את הרעיון.";
    else if (it.status === "approved" && it.reply) note.textContent = "התשובה מוצגת באתר מתחת להודעה.";

    node.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-act]");
      if (btn) act(it, btn.getAttribute("data-act"), node);
    });
    return node;
  }

  function openEditor(node, label, value, onSave) {
    var box = node.querySelector(".editor");
    var area = box.querySelector("textarea");
    box.hidden = false;
    box.querySelector(".editor-label").textContent = label;
    area.value = value || "";
    area.maxLength = 2000;
    area.focus();
    box.querySelector(".cancel").onclick = function () { box.hidden = true; };
    box.querySelector(".save").onclick = function () { onSave(area.value.trim()); };
  }

  async function update(it, fields) {
    fields.moderated_at = new Date().toISOString();
    var res = await sb.from("submissions").update(fields).eq("id", it.id).select("id");
    if (res.error) { setStatus("השמירה נכשלה: " + res.error.message, true); return false; }
    if (!res.data || !res.data.length) { setStatus("השמירה נדחתה (אין הרשאה).", true); return false; }
    return true;
  }

  async function act(it, action, node) {
    if (action === "edit") {
      openEditor(node, "טקסט ההודעה (יסומן באתר כ״נערך״)", it.body, async function (text) {
        if (text.length < 2) { setStatus("הטקסט קצר מדי.", true); return; }
        if (await update(it, { body: text, edited: true })) refresh("הטקסט עודכן.");
      });
      return;
    }
    if (action === "reply") {
      openEditor(node, "תשובה שתוצג באתר מתחת להודעה (השאירו ריק כדי למחוק תשובה)", it.reply, async function (text) {
        if (await update(it, { reply: text || null, replied_at: text ? new Date().toISOString() : null })) refresh("התשובה נשמרה.");
      });
      return;
    }
    if (action === "delete") {
      if (!window.confirm("למחוק את ההודעה של \"" + it.display_name + "\" לצמיתות? אי אפשר לבטל.")) return;
      var res = await sb.from("submissions").delete().eq("id", it.id).select("id");
      if (res.error || !res.data || !res.data.length) { setStatus("המחיקה נכשלה.", true); return; }
      refresh("ההודעה נמחקה.");
      return;
    }
    if (["approved", "rejected", "archived", "pending"].indexOf(action) !== -1) {
      if (await update(it, { status: action })) {
        refresh({ approved: "אושר ופורסם.", rejected: "נדחה.", archived: "הועבר לארכיון.", pending: "הוחזר להמתנה." }[action]);
      }
    }
  }

  // ---- Ratings ------------------------------------------------------------
  async function loadRatings() {
    setStatus("טוען…");
    var res = await sb.rpc("admin_rating_stats");
    var body = $("ratings-body");
    body.textContent = "";
    if (res.error) { setStatus("הטעינה נכשלה: " + res.error.message, true); return; }
    (res.data || []).forEach(function (r) {
      var tr = document.createElement("tr");
      [r.project_slug, r.ratings, r.average, r.s1, r.s2, r.s3, r.s4, r.s5].forEach(function (v) {
        var td = document.createElement("td");
        td.textContent = v == null ? "" : String(v);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    setStatus(res.data && res.data.length ? "" : "עדיין אין דירוגים.");
  }

  async function refresh(message) {
    var ratings = state.status === "ratings";
    $("ratings").hidden = !ratings;
    $("items").hidden = ratings;
    $("filters").hidden = ratings;
    loadCounts();
    if (ratings) await loadRatings();
    else await loadItems();
    if (typeof message === "string") setStatus(message);
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", String(x === tab)); });
      state.status = tab.getAttribute("data-status");
      refresh();
    });
  });
  $("kind").addEventListener("change", function () { refresh(); });
  $("search").addEventListener("input", render);
  $("reload").addEventListener("click", function () { refresh(); });

  // ---- Start --------------------------------------------------------------
  sb.auth.getSession().then(function (res) {
    if (res.data && res.data.session) enter();
    else showLogin("");
  });
})();

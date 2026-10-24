// BubaPix shop: the visitor's order.
//
// Products are added to an order kept in the visitor's own browser
// (localStorage). Sending the order opens the visitor's email app with the
// order details, addressed to the studio. No payment is taken on the site.
//
// Payment: the methods switched on in the admin (PayPal.Me, or a payment
// link from Bit, PayBox, Grow, a card provider…) are offered after the order
// request is sent. A full online checkout can later be added in SENDERS.
(function () {
  "use strict";

  var dataEl = document.getElementById("shop-data");
  if (!dataEl) return;
  var cfg;
  try { cfg = JSON.parse(dataEl.textContent); } catch (err) { return; }
  var t = cfg.t;
  var KEY = "bubapix-order";
  var locale = cfg.lang === "he" ? "he-IL" : "en-US";

  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* storage blocked */ }
    updateCount(items);
  }
  function money(amount, currency) {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency: currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount); }
    catch (e) { return amount + " " + currency; }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function updateCount(items) {
    var count = items.reduce(function (s, i) { return s + (i.qty || 0); }, 0);
    Array.prototype.forEach.call(document.querySelectorAll("[data-order-count]"), function (n) { n.textContent = String(count); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-order-link]"), function (n) { n.hidden = count === 0; });
  }
  function optionsText(item) {
    return Object.keys(item.options || {}).map(function (k) { return k + ": " + item.options[k]; }).join(", ");
  }
  // Price of one line for the chosen destination.
  function linePrice(item, dest) {
    if (dest === "abroad" && item.priceAbroad !== null) return { amount: item.priceAbroad, currency: item.currencyAbroad };
    if (item.price !== null) return { amount: item.price, currency: item.currency };
    return null;
  }

  // ---- Prices in another currency (approximate) ---------------------------
  // The visitor may choose a currency; prices are then converted with the
  // exchange rates built into the page and marked "≈". The order and any
  // payment always use the price's own currency.
  var CUR_KEY = "bubapix-currency";
  var cur = cfg.currency || { codes: [], rates: {} };
  function picked() {
    var c = "";
    try { c = localStorage.getItem(CUR_KEY) || ""; } catch (e) { /* storage blocked */ }
    return cur.codes.indexOf(c) !== -1 ? c : "";
  }
  function convert(amount, from, to) {
    if (!to || from === to) return null;
    var a = cur.rates[from], b = cur.rates[to];
    if (!a || !b) return null;
    var v = amount / a * b;
    return v >= 20 ? Math.round(v) : Math.round(v * 100) / 100;
  }
  function approx(amount, from) {
    var to = picked();
    var v = convert(amount, from, to);
    return v === null ? "" : t.approxPrefix + money(v, to);
  }
  function applyCurrency() {
    var to = picked();
    Array.prototype.forEach.call(document.querySelectorAll("[data-amount]"), function (n) {
      if (!n.hasAttribute("data-original")) n.setAttribute("data-original", n.textContent);
      var a = approx(Number(n.getAttribute("data-amount")), n.getAttribute("data-cur"));
      var from = n.getAttribute("data-from") ? t.from + (/־$/.test(t.from) ? "" : " ") : "";
      n.textContent = a ? from + a : n.getAttribute("data-original");
      if (a) n.title = n.getAttribute("data-original"); else n.removeAttribute("title");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-currency-pick]"), function (sel) { sel.value = to; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-currency-note]"), function (n) {
      n.hidden = !to;
      n.textContent = to ? t.approxNote.replace("{cur}", to).replace("{date}", cur.date || "") : "";
    });
  }
  if (cur.codes.length) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-currency-box]"), function (box) {
      box.hidden = false;
      box.querySelector("select").addEventListener("change", function (ev) {
        try { if (ev.target.value) localStorage.setItem(CUR_KEY, ev.target.value); else localStorage.removeItem(CUR_KEY); } catch (e) { /* storage blocked */ }
        applyCurrency();
        if (typeof renderOrder === "function") renderOrder();
      });
    });
    applyCurrency();
  }
  var renderOrder = null;

  // ---- Product page: add to order --------------------------------------
  var form = document.querySelector("[data-add-to-order]");
  if (form && cfg.emails.length) {
    form.hidden = false;
    // The options are now chosen in the form, so the plain list is not repeated.
    var plainOptions = document.querySelector(".product-variants");
    if (plainOptions) plainOptions.hidden = true;
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var num = function (v) { return v === "" || v == null ? null : Number(v); };
      var options = {};
      Array.prototype.forEach.call(form.querySelectorAll("select[data-option]"), function (s) { options[s.getAttribute("data-option")] = s.value; });
      var qty = Math.max(1, Math.min(99, parseInt(form.elements.qty.value, 10) || 1));
      var item = {
        slug: form.getAttribute("data-slug"),
        title: form.getAttribute("data-title"),
        price: num(form.getAttribute("data-price")),
        currency: form.getAttribute("data-currency"),
        priceAbroad: num(form.getAttribute("data-price-abroad")),
        currencyAbroad: form.getAttribute("data-currency-abroad"),
        ships: form.getAttribute("data-ships"),
        options: options,
        qty: qty,
      };
      var items = load();
      var same = items.filter(function (i) { return i.slug === item.slug && JSON.stringify(i.options) === JSON.stringify(item.options); })[0];
      if (same) same.qty = Math.min(99, same.qty + qty); else items.push(item);
      save(items);
      status.textContent = "";
      status.appendChild(document.createTextNode(t.added + " "));
      var a = el("a", null, t.viewOrder);
      a.href = cfg.orderUrl;
      status.appendChild(a);
    });
  }

  // ---- Product photos: thumbnails choose the large photo -----------------
  var slides = document.querySelectorAll("[data-slide]");
  Array.prototype.forEach.call(document.querySelectorAll("[data-thumb]"), function (btn) {
    btn.addEventListener("click", function () {
      var n = btn.getAttribute("data-thumb");
      Array.prototype.forEach.call(slides, function (s) { s.classList.toggle("is-active", s.getAttribute("data-slide") === n); });
      Array.prototype.forEach.call(document.querySelectorAll("[data-thumb]"), function (b) { if (b === btn) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    });
  });

  // ---- Order page --------------------------------------------------------
  var root = document.querySelector("[data-order]");
  if (root) {
    root.hidden = false;
    var list = root.querySelector("[data-order-items]");
    var empty = root.querySelector("[data-order-empty]");
    var orderForm = root.querySelector("[data-order-form]");
    var totalEl = root.querySelector("[data-order-total]");
    var linesEl = root.querySelector("[data-order-lines]");
    var addLine = function (dt, dd) {
      var d = el("div");
      d.appendChild(el("dt", null, dt));
      d.appendChild(el("dd", null, dd));
      linesEl.appendChild(d);
    };
    var ostatus = orderForm.querySelector(".form-status");
    var dest = function () { var c = orderForm.querySelector("input[name=dest]:checked"); return c ? c.value : "israel"; };

    // Draws the list of items. A change of quantity does not redraw the list
    // (only that item's price and the summary), so the focus stays in the
    // quantity box. After "Remove" the focus moves to the next item's
    // "Remove" (or the previous one, or the "empty" message).
    var render = function (after) {
      var items = load();
      list.textContent = "";
      empty.hidden = items.length > 0;
      orderForm.hidden = items.length === 0;
      items.forEach(function (item, idx) {
        var li = el("li", "order-item");
        var info = el("div", "order-info");
        var nameEl = el("p", "order-name", item.title);
        nameEl.id = "order-item-" + idx;
        info.appendChild(nameEl);
        var opts = optionsText(item);
        if (opts) info.appendChild(el("p", "order-options", opts));
        if (dest() === "abroad" && item.ships === "israel") info.appendChild(el("p", "order-warn", t.shipsTo.israel));
        var lp = linePrice(item, dest());
        var priceEl = null;
        if (lp) {
          priceEl = el("p", "order-price", money(lp.amount * item.qty, lp.currency));
          info.appendChild(priceEl);
        }
        li.appendChild(info);
        var qtyLabel = el("label", "field field-qty");
        qtyLabel.appendChild(el("span", null, t.quantity));
        var q = el("input");
        q.type = "number"; q.min = "1"; q.max = "99"; q.value = String(item.qty); q.inputMode = "numeric";
        // Screen readers hear which item the quantity and "Remove" belong to.
        q.setAttribute("aria-describedby", nameEl.id);
        q.addEventListener("change", function () {
          var n = Math.max(1, Math.min(99, parseInt(q.value, 10) || 1));
          q.value = String(n);
          var all = load();
          if (!all[idx]) return;
          all[idx].qty = n;
          save(all);
          if (priceEl) priceEl.textContent = money(lp.amount * n, lp.currency);
          summary(all);
        });
        qtyLabel.appendChild(q);
        li.appendChild(qtyLabel);
        var rm = el("button", "link-button", t.remove);
        rm.type = "button";
        rm.setAttribute("aria-describedby", nameEl.id);
        rm.addEventListener("click", function () { var all = load(); all.splice(idx, 1); save(all); render({ removed: idx }); });
        li.appendChild(rm);
        list.appendChild(li);
      });
      summary(items);
      if (after && typeof after.removed === "number") {
        var buttons = list.querySelectorAll(".link-button");
        if (buttons.length) buttons[Math.min(after.removed, buttons.length - 1)].focus();
        else empty.focus();
      }
    };

    var summary = function (items) {
      var totals = {};
      items.forEach(function (item) {
        var lp = linePrice(item, dest());
        if (lp) totals[lp.currency] = (totals[lp.currency] || 0) + lp.amount * item.qty;
      });
      var codes = Object.keys(totals);
      // Summary: products, VAT (when added), shipping to the chosen
      // destination (when its price is set in the same currency), total.
      linesEl.textContent = "";
      var payTotals = {};
      codes.forEach(function (c) { payTotals[c] = totals[c]; });
      if (codes.length === 1) {
        var c0 = codes[0], sum = totals[c0];
        addLine(t.subtotal, money(sum, c0));
        if (cfg.vat && cfg.vat.mode === "added") {
          var v = Math.round(sum * cfg.vat.rate) / 100;
          addLine(t.vatLine + " (" + cfg.vat.rate + "%)", money(v, c0));
          sum += v;
        } else if (cfg.vat && cfg.vat.mode === "included") {
          addLine(t.vatLine + " (" + cfg.vat.rate + "%)", t.vatIncluded);
        }
        var physical = items.some(function (i) { return i.ships !== "digital"; });
        var ship = dest() === "abroad" ? cfg.shipAbroad : cfg.shipIsrael;
        if (!physical) addLine(t.shippingLine, t.noShipping);
        else if (ship && ship.currency === c0) {
          var free = dest() !== "abroad" && cfg.freeIsraelFrom !== null && cfg.freeIsraelFrom !== undefined && sum >= cfg.freeIsraelFrom;
          addLine(t.shippingLine, free ? t.freeShipping : money(ship.amount, c0));
          if (!free) sum += ship.amount;
        }
        else if (ship) addLine(t.shippingLine, money(ship.amount, ship.currency));
        payTotals[c0] = sum;
        var a = approx(sum, c0);
        totalEl.textContent = (physical && !(ship && ship.currency === c0) ? t.total : t.totalPay) + ": " + money(sum, c0) + (a ? " (" + a + ")" : "");
      } else {
        totalEl.textContent = codes.length > 1 ? t.mixed : "";
      }
      lastTotals = payTotals;
      updateCount(items);
    };
    renderOrder = render;
    var lastTotals = {};

    Array.prototype.forEach.call(orderForm.querySelectorAll("input[name=dest]"), function (r) { r.addEventListener("change", function () { render(); }); });

    // The name field: its own error line, linked for screen readers.
    var nameInput = orderForm.elements.name;
    var nameError = document.getElementById("err-order-name");
    var nameMark = function (text) {
      if (text) {
        nameInput.setAttribute("aria-invalid", "true");
        if (nameError) { nameError.textContent = text; nameError.hidden = false; nameInput.setAttribute("aria-describedby", nameError.id); }
      } else {
        nameInput.removeAttribute("aria-invalid");
        nameInput.removeAttribute("aria-describedby");
        if (nameError) { nameError.textContent = ""; nameError.hidden = true; }
      }
    };
    nameInput.addEventListener("input", function () { if (nameInput.getAttribute("aria-invalid")) nameMark(""); });

    // How an order is sent. Only email exists now (no online payment).
    var SENDERS = {
      email: function sendByEmail(order) {
        var lines = order.items.map(function (i) {
          var lp = linePrice(i, order.dest);
          var opts = optionsText(i);
          return "- " + i.title + (opts ? " (" + opts + ")" : "") + " × " + i.qty + (lp ? " = " + money(lp.amount * i.qty, lp.currency) : "");
        });
        var body = [
          t.orderTitle + ":", "", lines.join("\n"), "",
          Array.prototype.map.call(linesEl.querySelectorAll("div"), function (d) { return d.firstChild.textContent + ": " + d.lastChild.textContent; }).join("\n"),
          totalEl.textContent.replace(/ \(≈ [^)]*\)$/, ""),
          approxLine(),
          t.destination + ": " + (order.dest === "abroad" ? t.abroad : t.israel),
          t.nameLabel + ": " + order.name,
          order.notes ? t.notesLabel + ": " + order.notes : "",
        ].filter(function (x) { return x !== ""; }).join("\n");
        var subject = t.orderSubject + " — " + order.name;
        // A real link, clicked: the standard way to open the visitor's email app.
        var a = el("a");
        a.href = "mailto:" + cfg.emails.join(",") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        a.hidden = true;
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
    };

    function approxLine() {
      var codes = Object.keys(lastTotals);
      var a = codes.length === 1 ? approx(lastTotals[codes[0]], codes[0]) : "";
      return a ? t.approxEmail + ": " + a.replace(t.approxPrefix, "") : "";
    }

    // Payment methods (switched on in the admin). Each opens the provider's
    // own secure page; the site never handles card details.
    var payBox = root.querySelector("[data-pay]");
    function showPayment() {
      if (!payBox || !(cfg.payments || []).length) return;
      var codes = Object.keys(lastTotals);
      var one = codes.length === 1;
      var amountEl = payBox.querySelector("[data-pay-amount]");
      amountEl.textContent = one ? t.payAmount + ": " + money(lastTotals[codes[0]], codes[0]) : t.payMixed;
      var list = payBox.querySelector("[data-pay-list]");
      list.textContent = "";
      cfg.payments.forEach(function (m) {
        var li = el("li", "pay-item");
        var a = el("a", "button", t.payWith + m.label);
        a.rel = "noopener";
        a.target = "_blank";
        if (m.kind === "paypal") {
          // PayPal.Me accepts the amount and currency in the address.
          var amt = one ? "/" + (Math.round(lastTotals[codes[0]] * 100) / 100) + codes[0] : "";
          a.href = "https://www.paypal.me/" + encodeURIComponent(m.handle) + amt;
        } else {
          a.href = m.url;
        }
        li.appendChild(a);
        if (m.kind !== "paypal" || !one) li.appendChild(el("p", "form-note", t.payEnter));
        if (m.note) li.appendChild(el("p", "form-note", m.note));
        list.appendChild(li);
      });
      payBox.hidden = false;
    }

    orderForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var name = orderForm.elements.name.value.trim();
      if (!name) {
        ostatus.textContent = t.missing;
        ostatus.className = "form-status is-error";
        nameMark(t.missing);
        nameInput.focus();
        return;
      }
      nameMark("");
      var items = load();
      if (!items.length || !cfg.emails.length) return;
      SENDERS.email({ items: items, dest: dest(), name: name, notes: orderForm.elements.notes.value.trim() });
      // We cannot know whether the visitor sent the email, so we never say
      // "order received"; we explain what happens and show the address.
      ostatus.className = "form-status";
      ostatus.textContent = t.opened + " " + cfg.emails.join(" · ");
      showPayment();
    });

    render();
  }

  updateCount(load());
})();

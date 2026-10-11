/* ==========================================================
   BubaPix — homepage script
   1. Opens the letterbox and reveals the headline on load.
   2. Draws the temporary hero background: a projector beam
      cutting through haze, with dust drifting in the light.
   No libraries. Pauses when the hero is off screen or the
   tab is hidden. Respects "reduce motion".
   ========================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Footer year
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Opening sequence: wait one frame so the closed state paints first.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add("is-loaded"); });
  });

  // ---------- Projector beam ----------
  var canvas = document.querySelector(".hero-canvas");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var hero = document.querySelector(".hero");

  var W = 0, H = 0, DPR = 1;
  var dust = [];
  var running = false;
  var visible = true;
  var lastFrame = 0;
  var FRAME_MS = 1000 / 30; // 30 fps is plenty for haze and dust

  // Beam geometry, recalculated on resize.
  var src = { x: 0, y: 0 };    // projector lens (off screen, top right)
  var aim = 0;                  // current beam angle, radians
  var aimTarget = 0;            // where the pointer wants it
  var aimBase = 0;              // resting angle
  var SPREAD = 0.2;             // half-angle of the cone, radians

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    src.x = W * 0.86;
    src.y = -H * 0.18;
    // Aim toward the lower-left third of the frame.
    aimBase = Math.atan2(H * 1.05 - src.y, W * 0.22 - src.x);
    aim = aimTarget = aimBase;

    // Dust count scales with area, capped for phones.
    var count = Math.min(220, Math.round((W * H) / 7000));
    dust = [];
    for (var i = 0; i < count; i++) dust.push(makeMote(true));
  }

  function makeMote(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -5,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.12,
      vy: Math.random() * 0.12 + 0.02,
      phase: Math.random() * Math.PI * 2
    };
  }

  // Draws one cone of light from the lens.
  function cone(halfAngle, color, alpha) {
    var len = Math.hypot(W, H) * 1.4;
    var a1 = aim - halfAngle, a2 = aim + halfAngle;
    var g = ctx.createLinearGradient(
      src.x, src.y,
      src.x + Math.cos(aim) * len, src.y + Math.sin(aim) * len
    );
    g.addColorStop(0, "rgba(" + color + "," + alpha + ")");
    g.addColorStop(0.55, "rgba(" + color + "," + alpha * 0.45 + ")");
    g.addColorStop(1, "rgba(" + color + ",0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(src.x + Math.cos(a1) * len, src.y + Math.sin(a1) * len);
    ctx.lineTo(src.x + Math.cos(a2) * len, src.y + Math.sin(a2) * len);
    ctx.closePath();
    ctx.fill();
  }

  function draw(t) {
    // Projection room
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#120d0a";
    ctx.fillRect(0, 0, W, H);

    // Lamp flicker: small, irregular, like a real bulb at 24 fps.
    var flicker = 0.92 + 0.05 * Math.sin(t * 0.011) + 0.03 * Math.sin(t * 0.037 + 1.3);

    // Layered cones give the beam soft edges without blur filters.
    ctx.globalCompositeOperation = "lighter";
    // Many thin layers, from cool outer haze to a hot tungsten core.
    var LAYERS = 14;
    for (var k = 0; k < LAYERS; k++) {
      var f = k / (LAYERS - 1);                       // 0 = outer, 1 = core
      var color = f < 0.25 ? "127,167,181" : f < 0.8 ? "242,182,109" : "255,218,170";
      cone(SPREAD * (2 - f * 1.65), color, (0.012 + f * 0.022) * flicker);
    }

    // Glow at the lens
    var lens = ctx.createRadialGradient(src.x, src.y + H * 0.18, 0, src.x, src.y + H * 0.18, H * 0.45);
    lens.addColorStop(0, "rgba(255,210,150," + 0.22 * flicker + ")");
    lens.addColorStop(1, "rgba(255,210,150,0)");
    ctx.fillStyle = lens;
    ctx.fillRect(0, 0, W, H);

    // Dust: bright inside the beam, nearly invisible outside it.
    for (var i = 0; i < dust.length; i++) {
      var m = dust[i];
      var dx = m.x - src.x, dy = m.y - src.y;
      var off = Math.abs(angleDiff(Math.atan2(dy, dx), aim));
      var inBeam = Math.max(0, 1 - off / (SPREAD * 1.2));
      var twinkle = 0.6 + 0.4 * Math.sin(t * 0.002 + m.phase);
      var a = (0.04 + inBeam * inBeam * 0.75) * twinkle * flicker;
      if (a < 0.02) continue;
      ctx.fillStyle = "rgba(255,226,186," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vignette, so the edges fall into darkness like a cinema.
    ctx.globalCompositeOperation = "source-over";
    var v = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.3, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    v.addColorStop(0, "rgba(18,13,10,0)");
    v.addColorStop(1, "rgba(8,5,4,0.85)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  function step() {
    for (var i = 0; i < dust.length; i++) {
      var m = dust[i];
      m.vx += (Math.random() - 0.5) * 0.01; // Brownian drift
      m.vx *= 0.99;
      m.x += m.vx;
      m.y += m.vy;
      if (m.y > H + 5 || m.x < -5 || m.x > W + 5) dust[i] = makeMote(false);
    }
    aim += (aimTarget - aim) * 0.04; // ease toward the pointer
  }

  function angleDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    step();
    draw(now);
  }

  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  resize();
  draw(0);

  if (reduceMotion) {
    window.addEventListener("resize", function () { resize(); draw(0); });
    return;
  }

  window.addEventListener("resize", resize);

  // The pointer gently steers the beam, like a hand on the projector.
  hero.addEventListener("pointermove", function (e) {
    var nx = e.clientX / W - 0.5; // -0.5 … 0.5
    aimTarget = aimBase - nx * 0.18;
  });
  hero.addEventListener("pointerleave", function () { aimTarget = aimBase; });

  // Pause when the hero scrolls away or the tab is hidden.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : start();
  });

  start();
})();

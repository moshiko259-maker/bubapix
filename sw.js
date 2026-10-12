// BubaPix: helper that lets the installed site open fast and work offline.
"use strict";
const CACHE = "bubapix-5eb5d501cb83";
const HOME = new URL("./", self.location).href;
// Shown when there is no connection and the page was never saved. A page is
// never shown at another page's address (its links would break).
const OFFLINE = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BubaPix</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f6ef;color:#16161d;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:600;margin:0 0 8px">אין חיבור לאינטרנט</p><p style="margin:0 0 20px" lang="en" dir="ltr">You are offline</p>
<a href="${HOME}" style="color:#16161d">BubaPix</a></div></body></html>`;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bubapix-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/admin/")) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })))
    );
    return;
  }
  if (!/\.(css|js|webp|jpe?g|png|svg|woff2|webmanifest)$/.test(url.pathname)) return;
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});

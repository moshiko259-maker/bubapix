// Downloads the picture YouTube shows for each YouTube video on the site, and
// keeps it on the site itself (assets/video-posters/youtube-<id>.jpg). A video
// shows this picture until the visitor presses "play"; because the picture is a
// file of this site, nothing is loaded from YouTube before that press (as the
// privacy page says).
//
// Run by the build workflow before the site is built. A picture that is already
// here is not downloaded again. If a download fails (no internet, a removed
// video), the video keeps the project's poster and the build continues.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const OUT = path.join(root, "assets", "video-posters");
const ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/;

function videoIds() {
  const ids = new Set();
  const add = (url) => { const m = ID.exec(String(url || "")); if (m) ids.add(m[1]); };
  const dir = path.join(root, "content", "projects");
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    add(p.video_url);
    for (const sec of Array.isArray(p.sections) ? p.sections : []) {
      if (sec && sec.type === "videos" && Array.isArray(sec.items)) sec.items.forEach((v) => add(typeof v === "string" ? v : v && v.url));
    }
  }
  try { add(JSON.parse(fs.readFileSync(path.join(root, "content", "site.json"), "utf8")).showreel_url); } catch (e) { /* no site file */ }
  return [...ids];
}

// A JPEG that is bigger than YouTube's small "no picture" placeholder (120×90).
function isPicture(buf) {
  if (!buf || buf.length < 4000 || buf[0] !== 0xff || buf[1] !== 0xd8) return false;
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return false;
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return buf.readUInt16BE(i + 7) > 200;
    i += 2 + len;
  }
  return false;
}

(async () => {
  const ids = videoIds();
  fs.mkdirSync(OUT, { recursive: true });
  let got = 0, kept = 0, failed = 0;
  for (const id of ids) {
    const file = path.join(OUT, `youtube-${id}.jpg`);
    if (fs.existsSync(file)) { kept++; continue; }
    let ok = false;
    // The largest picture first (not every video has it), then the standard one.
    for (const name of ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"]) {
      try {
        const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (!isPicture(buf)) continue;
        fs.writeFileSync(file, buf);
        ok = true;
        break;
      } catch (e) { /* try the next size */ }
    }
    if (ok) got++; else failed++;
  }
  console.log(`Video pictures: ${got} downloaded, ${kept} already here, ${failed} not available (those videos keep the project's poster).`);
})();

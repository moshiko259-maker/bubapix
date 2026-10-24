/*
 * BubaPix: publish the private test site right after a save (owner only).
 *
 * Loaded by the on-page editors; never by visitors. After the owner saves,
 * the site's own build (the "Build pages" workflow of the site repository)
 * makes the pages; then this asks the test site's repository to publish
 * them at once (its "Publish test site" workflow), instead of waiting for
 * GitHub's schedule, which can take half an hour.
 *
 * It works only on the test site (an address like <owner>.github.io/<name>-preview/)
 * and only with the owner's own GitHub sign-in, which needs "Actions: Read
 * and write" on both repositories. Without that permission nothing breaks:
 * the test site is published on its schedule as before. The live site is
 * never touched.
 */
(function () {
  "use strict";
  if (window.BubaPublish) return;

  var launcher = document.querySelector("[data-page-editor]");
  var REPO = launcher ? launcher.getAttribute("data-repo") || "" : "";
  var host = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  var first = location.pathname.split("/")[1] || "";
  var PREVIEW = host && /^[a-z0-9._-]+-preview$/i.test(first) ? host[1] + "/" + first : "";

  function token() {
    try { var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null"); if (u && typeof u.token === "string" && u.token) return u.token; } catch (e) { /* storage blocked */ }
    return "";
  }
  function api(url, opts) {
    opts = opts || {};
    var headers = { "Accept": "application/vnd.github+json", "Authorization": "token " + token() };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + url, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (res) {
        if (!res.ok) { var err = new Error("GitHub " + res.status); err.status = res.status; throw err; }
        return res.status === 204 ? null : res.json();
      });
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // The build of this save: "success", "cancelled" (a newer save took over),
  // "failure", or "unknown" (the runs cannot be read: then wait a little).
  function build(sha, tries) {
    return api("/repos/" + REPO + "/actions/runs?head_sha=" + encodeURIComponent(sha) + "&per_page=10")
      .then(function (d) {
        var run = (d && d.workflow_runs || []).filter(function (r) { return r.name === "Build pages"; })[0];
        if (run && run.status === "completed") return run.conclusion || "unknown";
        if (tries >= 40) return "unknown"; // about 7 minutes
        return wait(10000).then(function () { return build(sha, tries + 1); });
      }, function () { return wait(75000).then(function () { return "unknown"; }); });
  }
  var latest = "";
  window.BubaPublish = {
    // After a save: wait for its build, then publish the test site. Resolves to true when asked.
    after: function (sha) {
      if (!PREVIEW || !REPO || !sha || !token()) return Promise.resolve(false);
      latest = sha;
      return build(sha, 0).then(function (result) {
        if (latest !== sha || (result !== "success" && result !== "unknown")) return false;
        return api("/repos/" + PREVIEW + "/actions/workflows/preview.yml/dispatches", { method: "POST", body: { ref: "main" } })
          .then(function () { return true; }, function () { return false; });
      });
    },
  };
})();

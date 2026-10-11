// A small, safe Markdown converter for texts written in the admin panel.
// Supports: paragraphs, line breaks, ## and ### headings, **bold**, *italic*,
// [links](https://…), bullet lists (- item) and numbered lists (1. item).
// All other HTML is escaped, so text can never inject code into the page.

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  let s = esc(text);
  // Links: only web, email and phone addresses are allowed.
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)\s]+)\)/g, (_, label, url) => {
    const external = /^https?:/.test(url);
    return `<a href="${url}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s;
}

module.exports = function markdown(src) {
  if (!src || !String(src).trim()) return "";
  const blocks = String(src).replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const h = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
      if (h && lines.length === 1) {
        const level = h[1].length; // ## -> h2, ### -> h3
        return `<h${level}>${inline(h[2])}</h${level}>`;
      }
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
};

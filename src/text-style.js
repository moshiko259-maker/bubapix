// Text styles chosen by the owner in the on-page editors (js/text-style.js):
// size, alignment, spacing and font for a kind of text on a page, the same in
// both languages. Saved in content/styles.json as
//   { "<key>": { "size": "z6", "align": "center", "space": 1, "font": "frank" } }
// where <key> is the element's data-ts (e.g. "about/title", "services/item-name").
// The build adds the matching classes (css/styles.css) to every element with
// that data-ts; anything unknown in the file is ignored.
"use strict";

const SIZES = ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8", "z9", "z10", "z11"];
const ALIGNS = ["start", "center", "end"];
const SPACES = [-1, 1, 2];
const FONTS = ["heebo", "rubik", "assistant", "frank", "secular", "varela", "amatic", "suez"];

function classesFor(st) {
  if (!st || typeof st !== "object") return [];
  const out = [];
  if (SIZES.includes(st.size)) out.push(`ts-${st.size}`);
  if (ALIGNS.includes(st.align)) out.push(`ts-a-${st.align}`);
  if (SPACES.includes(st.space)) out.push(st.space < 0 ? "ts-sp-m1" : `ts-sp-${st.space}`);
  if (FONTS.includes(st.font)) out.push(`ts-f-${st.font}`);
  return out;
}

// Adds the classes to every start tag that has data-ts="<key>" with a saved style.
function applyStyles(html, styles) {
  if (!styles || typeof styles !== "object" || !html.includes("data-ts=")) return html;
  return html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)(\s[^<>]*?\sdata-ts="([^"]+)"[^<>]*?|\sdata-ts="([^"]+)"[^<>]*?)>/g, (tag, name, attrs, k1, k2) => {
    const cls = classesFor(Object.prototype.hasOwnProperty.call(styles, k1 || k2) ? styles[k1 || k2] : null);
    if (!cls.length) return tag;
    if (/\sclass="/.test(attrs)) return `<${name}${attrs.replace(/\sclass="([^"]*)"/, (m, c) => ` class="${c ? c + " " : ""}${cls.join(" ")}"`)}>`;
    return `<${name} class="${cls.join(" ")}"${attrs}>`;
  });
}

module.exports = { applyStyles, classesFor, SIZES, ALIGNS, SPACES, FONTS };

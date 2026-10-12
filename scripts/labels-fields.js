// Writes the "Interface texts" fields in admin/config.yml from src/labels-map.js.
// Run after changing the table:  node scripts/labels-fields.js
// The fields sit between the two marker comments in admin/config.yml.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const map = require("../src/labels-map");
const en = require("../src/i18n/en.json");
const he = require("../src/i18n/he.json");

const q = (s) => JSON.stringify(s); // YAML accepts JSON strings
const pad = "          ";
const lines = [];
map.forEach(([field, places, nameEn, nameHe], i) => {
  const [s, k] = places[0];
  const hint = i === 0 ? `, hint: ${q("Leave a field empty to keep the usual text. / שדה ריק משאיר את הטקסט הרגיל.")}` : "";
  lines.push(`${pad}- { name: ${field}_en, label: ${q(`${nameEn}, English (usual: ${en[s][k]}) / ${nameHe}, אנגלית`)}, widget: string, required: false${hint} }`);
  lines.push(`${pad}- { name: ${field}_he, label: ${q(`${nameEn}, Hebrew (usual: ${he[s][k]}) / ${nameHe}, עברית`)}, widget: string, required: false }`);
});

const file = path.join(root, "admin/config.yml");
const text = fs.readFileSync(file, "utf8");
const start = `${pad}# labels-fields:start (written by scripts/labels-fields.js)`;
const end = `${pad}# labels-fields:end`;
const a = text.indexOf(start);
const b = text.indexOf(end);
if (a < 0 || b < a) throw new Error("Marker comments not found in admin/config.yml");
fs.writeFileSync(file, text.slice(0, a) + [start, ...lines].join("\n") + "\n" + text.slice(b));
console.log(`Wrote ${lines.length} fields.`);

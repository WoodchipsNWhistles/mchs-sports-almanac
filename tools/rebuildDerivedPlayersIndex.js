const fs = require("fs");
const path = require("path");

const DERIVED_DIR = path.join(process.cwd(), "src", "_derived", "players");
const OUT = path.join(DERIVED_DIR, "index.json");

const ids = fs.readdirSync(DERIVED_DIR)
  .filter(f => f.endsWith(".json") && f !== "index.json")
  .map(f => f.replace(/\.json$/, ""))
  .sort();

fs.writeFileSync(OUT, JSON.stringify(ids, null, 2) + "\n", "utf8");
console.log(`Wrote ${OUT} (${ids.length} entries)`);
console.log(`Sample: ${ids.slice(0, 10).join(", ")}`);
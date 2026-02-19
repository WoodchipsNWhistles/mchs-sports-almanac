const fs = require("fs");
const path = require("path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

module.exports = function () {
  const dataDir = path.join(__dirname, "..", "lwbb", "data");
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

  const years = files
    .map((f) => parseInt(path.basename(f, ".json"), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const seasons = {};
  for (const y of years) {
    seasons[String(y)] = readJson(path.join(dataDir, `${y}.json`));
  }

  const metaPath = path.join(__dirname, "..", "lwbb", "meta", "seasons.json");
  const meta = fs.existsSync(metaPath) ? readJson(metaPath) : null;

  return { years, seasons, meta };
};

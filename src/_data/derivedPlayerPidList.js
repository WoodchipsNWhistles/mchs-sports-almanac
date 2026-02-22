const fs = require("fs");
const path = require("path");

module.exports = function () {
  const dir = path.join(process.cwd(), "src", "_derived", "players");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("p_") && f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
};
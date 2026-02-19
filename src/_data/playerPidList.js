const path = require("path");
const fs = require("fs");

function isPid(s) {
  return typeof s === "string" && /^p_\d{10}$/.test(s);
}

module.exports = function () {
  const p = path.join(process.cwd(), "src", "_derived", "players", "index.json");
  const ids = JSON.parse(fs.readFileSync(p, "utf8"));
  return ids.filter(isPid);
};
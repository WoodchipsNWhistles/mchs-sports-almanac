const fs = require("fs");
const path = require("path");

module.exports = function () {
  const p = path.join(__dirname, "..", "_derived", "players", "index.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
};

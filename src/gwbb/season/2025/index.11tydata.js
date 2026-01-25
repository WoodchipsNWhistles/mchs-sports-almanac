const fs = require("fs");
const path = require("path");

module.exports = async function () {
  const jsonPath = path.join(__dirname, "..", "..", "data", "2025.json");
  const raw = fs.readFileSync(jsonPath, "utf8");
  const season = JSON.parse(raw);
  return { season };
};

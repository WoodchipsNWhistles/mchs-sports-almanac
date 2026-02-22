// src/_data/lwbbSeasons.js
const fs = require("fs");
const path = require("path");

module.exports = function () {
  const dir = path.join(process.cwd(), "src", "lwbb", "data");
  if (!fs.existsSync(dir)) return [];

  const years = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => Number(f.replace(".json", "")))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  return years.map((y) => ({
    yearEnd: y,
    label: `${y - 1}–${String(y).slice(-2)}`,
    jsonFile: `${y}.json`,
  }));
};
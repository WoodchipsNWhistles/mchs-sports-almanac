// src/lwbb/season/_year/index.11tydata.js
const fs = require("fs");
const path = require("path");

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

module.exports = function (data) {
  const pageNumber = data?.pagination?.pageNumber;

  const item =
    Number.isInteger(pageNumber) && Array.isArray(data?.lwbbSeasons)
      ? data.lwbbSeasons[pageNumber]
      : null;

  const y = Number(item?.yearEnd);

  const filePath = Number.isFinite(y)
    ? path.join(process.cwd(), "src", "lwbb", "data", `${y}.json`)
    : null;

  const exists = filePath ? fs.existsSync(filePath) : false;
  const season = exists ? safeReadJson(filePath) : null;

  return {
    yearEnd: Number.isFinite(y) ? y : null,
    seasonJsonPath: filePath,
    seasonJsonExists: exists,
    seasonJsonMissing: !season,
    season,
  };
};
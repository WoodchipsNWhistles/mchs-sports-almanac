const fs = require("fs");
const path = require("path");

module.exports = function () {
  const p = path.join(process.cwd(), "src", "gwbb", "data", "seasonMeta.json");
  if (!fs.existsSync(p)) return {};

  const rows = JSON.parse(fs.readFileSync(p, "utf8"));

  // Index by seasonYearEnd (GWBB only for now)
  const idx = {};
  for (const r of rows || []) {
    if (!r) continue;
    if (String(r.sportCode || "").toUpperCase() !== "GWBB") continue;

    const y = Number(r.seasonYearEnd);
    if (!Number.isFinite(y)) continue;

    idx[y] = r;
  }
  return idx;
};

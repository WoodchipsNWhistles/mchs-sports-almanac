const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dataDir = path.join(__dirname, "..", "data"); // src/gwbb/data
  if (!fs.existsSync(dataDir)) return [];

  const years = fs
    .readdirSync(dataDir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => parseInt(f.replace(".json", ""), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a); // newest first

  return years.map((yearEnd) => {
    const start = yearEnd - 1;
    const yy = String(yearEnd).slice(-2);
    return {
      yearEnd,
      label: `${start}\u2013${yy}`,
      url: `/gwbb/season/${yearEnd}/`,
      jsonUrl: `/gwbb/data/${yearEnd}.json`,
    };
  });
};

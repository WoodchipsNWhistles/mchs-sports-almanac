cat > src/gwbb/_data/gwbbSeasons.js <<'JS'
const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dataDir = path.join(__dirname, "..", "data"); // src/gwbb/data
  if (!fs.existsSync(dataDir)) return [];

  const files = fs.readdirSync(dataDir)
    .filter(f => /^\d{4}\.json$/.test(f)) // 2025.json etc
    .map(f => parseInt(f.replace(".json", ""), 10))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => b - a); // newest first

  // Map to objects used by the template
  return files.map(yearEnd => {
    const start = yearEnd - 1;
    const yy = String(yearEnd).slice(-2);
    return {
      yearEnd,
      label: `${start}\u2013${yy}`,           // 2024–25
      url: `/gwbb/season/${yearEnd}/`,
      jsonUrl: `/gwbb/data/${yearEnd}.json`
    };
  });
};
JS

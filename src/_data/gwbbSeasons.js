const fs = require("fs");
const path = require("path");

module.exports = () => {
  // Always resolve from project root so this works anywhere
  const dataDir = path.join(process.cwd(), "src", "gwbb", "data");

  if (!fs.existsSync(dataDir)) return [];

  const years = fs.readdirSync(dataDir)
    .filter(f => /^\d{4}\.json$/.test(f))
    .map(f => parseInt(f.replace(".json", ""), 10))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => b - a);

  return years.map(yearEnd => {
    const start = yearEnd - 1;
    const yy = String(yearEnd).slice(-2);
    return {
      yearEnd,
      label: `${start}\u2013${yy}`,      // 2024–25
      url: `/gwbb/season/${yearEnd}/`,
      jsonUrl: `/gwbb/data/${yearEnd}.json`
    };
  });
};

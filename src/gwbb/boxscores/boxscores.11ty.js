const fs = require("fs");
const path = require("path");

const BOX_DIR = path.join(process.cwd(), "src", "gwbb", "boxscores");

function safeJsonParse(txt, filename) {
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filename}: ${e.message}`);
  }
}

// Tiny HTML escape helper (so JSON doesn’t break the page)
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = class BoxscorePages {
  async data() {
    const files = fs
      .readdirSync(BOX_DIR)
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .sort();

    const boxscores = files.map((filename) => {
      const fullPath = path.join(BOX_DIR, filename);
      const raw = fs.readFileSync(fullPath, "utf-8");
      const obj = safeJsonParse(raw, filename);

      const gameID = obj.gameID || path.basename(filename, ".json");

      return {
        ...obj,
        gameID,
        __sourceFile: filename,
      };
    });

    return {
      // IMPORTANT: pagination.data must be a STRING key, not the array itself
      boxscores,

      pagination: {
        data: "boxscores",
        size: 1,
        alias: "boxscore",
      },

      permalink: (data) => `/gwbb/boxscores/${data.boxscore.gameID}/index.html`,
    };
  }

  render(data) {
    const b = data.boxscore;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${b.gameID} — Box Score</title>
</head>
<body>
  <p><a href="/mchs-sports-almanac/gwbb/season/2025/">← Back to 2024–25 season</a></p>
  <h1>Box Score</h1>
  <h2>${b.gameID}</h2>

  <p><strong>Status:</strong> ${b.status || "ok"}</p>

  <h3>Raw JSON (temporary)</h3>
  <pre style="white-space: pre-wrap;">${escapeHtml(JSON.stringify(b, null, 2))}</pre>
</body>
</html>`;
  }
};

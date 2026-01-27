const fs = require("fs");
const path = require("path");

module.exports = () => {
  return {
    // If your _year page is paginated with alias: "s", this will run AFTER pagination context exists
    eleventyComputed: {
      yearEnd: (data) => data?.s?.yearEnd ?? null,

      seasonJsonPath: (data) => {
        const yearEnd = data?.s?.yearEnd;
        if (!yearEnd) return null;
        return path.join(process.cwd(), "src", "gwbb", "data", `${yearEnd}.json`);
      },

      seasonJsonMissing: (data) => {
        const p = data?.seasonJsonPath;
        return !p || !fs.existsSync(p);
      },

      season: (data) => {
        const p = data?.seasonJsonPath;
        if (!p || !fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, "utf8"));
      },
    },
  };
};

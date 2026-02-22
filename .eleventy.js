module.exports = function (eleventyConfig) {
// Read a JSON file from disk at render time
eleventyConfig.addFilter("readJson", function (relPath) {
  const fs = require("fs");
  const path = require("path");

  try {
    const abs = path.join(process.cwd(), relPath);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    return null;
  }
});
  // Copy static assets straight through to /docs/assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/gwbb/data": "gwbb/data" });
  eleventyConfig.addPassthroughCopy({ "CNAME": "CNAME" });

  // GWBB seasons collection (newest first)
  eleventyConfig.addCollection("gwbbSeasons", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/gwbb/season/*/index.njk")
      .sort((a, b) => {
        // prefer explicit seasonYearEnd/seasonYear; fall back to folder name
        const ay = Number(a.data.seasonYearEnd ?? a.data.seasonYear ?? a.fileSlug);
        const by = Number(b.data.seasonYearEnd ?? b.data.seasonYear ?? b.fileSlug);
        return by - ay; // DESC = newest first
      })
      .map((item) => {
        const y = Number(item.data.seasonYearEnd ?? item.data.seasonYear ?? item.fileSlug);
        return {
          url: item.url,
          label: item.data.display || item.data.title || `${y - 1}–${String(y).slice(-2)}`,
          yearEnd: y,
        };
      });
  });
// LWBB seasons collection (newest first) — same shape as GWBB
eleventyConfig.addCollection("lwbbSeasons", (collectionApi) => {
  return collectionApi.getAll().filter((item) =>
    item.url && item.url.startsWith("/lwbb/season/") && item.url.endsWith("/")
  ).sort((a,b) => {
    const ay = Number(a.data.yearEnd ?? a.data.seasonYearEnd ?? a.data.seasonYear ?? a.fileSlug);
    const by = Number(b.data.yearEnd ?? b.data.seasonYearEnd ?? b.data.seasonYear ?? b.fileSlug);
    return by - ay;
  }).map((item) => {
    const y = Number(item.data.yearEnd ?? item.data.seasonYearEnd ?? item.data.seasonYear ?? item.fileSlug);
    return { url: item.url, label: item.data.title || `${y-1}–${String(y).slice(-2)}`, yearEnd: y };
  });
});
  return {
    pathPrefix: "/",
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes"
    }
  };
};

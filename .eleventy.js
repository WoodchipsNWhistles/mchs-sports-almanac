module.exports = function (eleventyConfig) {
  // Copy static assets straight through to /docs/assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/gwbb/data": "gwbb/data" });

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
  return {
    pathPrefix: "/",
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes"
    }
  };
};

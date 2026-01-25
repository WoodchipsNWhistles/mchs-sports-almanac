module.exports = function (eleventyConfig) {
  // Copy static assets straight through to /docs/assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  return {
    pathPrefix: "/mchs-sports-almanac/",
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes"
    }
  };
};

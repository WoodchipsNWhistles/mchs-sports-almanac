module.exports = function (eleventyConfig) {
  // Copy static assets straight through to /docs/assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/gwbb/data": "gwbb/data" });


  return {
    pathPrefix: "/",
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes"
    }
  };
};

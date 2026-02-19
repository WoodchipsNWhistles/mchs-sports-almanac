module.exports = {
  // Keep all LWBB output under /lwbb/
  eleventyComputed: {
    permalink: (data) => data.page?.filePathStem === "/lwbb/index"
      ? "/lwbb/index.html"
      : data.permalink,
  }
};

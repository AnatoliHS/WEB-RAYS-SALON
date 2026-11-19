// sitemap.xml needs absolute URLs, so it is only written once site.url is set
// in src/_data/site.json.
class Sitemap {
  data() {
    return {
      eleventyExcludeFromCollections: true,
      permalink: (data) => (data.site.url ? "/sitemap.xml" : false),
    };
  }

  render({ site, collections }) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = collections.all
      .filter((p) => p.url && !p.data.robots?.includes("noindex"))
      .map((p) => `  <url><loc>${site.url}${p.url}</loc><lastmod>${today}</lastmod></url>`)
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  }
}

module.exports = Sitemap;

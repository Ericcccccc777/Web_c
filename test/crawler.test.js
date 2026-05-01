import test from "node:test";
import assert from "node:assert/strict";
import { NoticeCrawler } from "../src/crawlers/NoticeCrawler.js";

test("builds common government index pagination urls", () => {
  const crawler = new NoticeCrawler();

  assert.deepEqual(
    crawler.buildPageUrls({
      url: "https://example.gov.cn/tzgg/index.html",
      pageCount: 3
    }),
    [
      "https://example.gov.cn/tzgg/index.html",
      "https://example.gov.cn/tzgg/index_2.html",
      "https://example.gov.cn/tzgg/index_3.html"
    ]
  );

  assert.deepEqual(
    crawler.buildPageUrls({
      url: "https://example.gov.cn/tzgg/",
      pageCount: 2
    }),
    ["https://example.gov.cn/tzgg/", "https://example.gov.cn/tzgg/index_2.html"]
  );
});

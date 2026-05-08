const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, stat, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { ExportService } = require("../src/services/ExportService.js");

test("exports selected notice as docx file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "notice-export-"));
  const originalFetch = globalThis.fetch;
  const service = new ExportService({
    noticeStore: {
      async noticesByDate() {
        return [
          {
            siteId: "demo",
            siteName: "测试站点",
            title: "关于测试项目申报的通知",
            date: "2026-04-30",
            url: "https://example.com/post.html"
          }
        ];
      }
    },
    settingsStore: {
      async update() {
        return { exportPath: dir };
      }
    }
  });

  globalThis.fetch = async () =>
    new Response(`
      <html>
        <head>
          <meta name="ArticleTitle" content="关于测试项目申报的通知">
          <meta name="PubDate" content="2026-04-30 10:00">
          <meta name="ContentSource" content="测试来源">
        </head>
        <body>
          <div class="zw">
            <p>这是详情页正文第一段。</p>
            <p>这是详情页正文第二段。</p>
          </div>
        </body>
      </html>
    `);

  try {
    const result = await service.exportNotices({
      date: "2026-04-30",
      noticeKeys: ["demo:2026-04-30:关于测试项目申报的通知"],
      format: "word",
      filename: "post-body",
      exportPath: dir
    });

    assert.equal(result.count, 1);
    assert.ok(result.path.endsWith(".docx"));
    const fileStat = await stat(result.path);
    assert.ok(fileStat.size > 0);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExportService } from "../src/services/ExportService.js";

test("exports selected notice post body instead of the archive summary", async () => {
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
          <h3 class="zw-title">关于测试项目申报的通知</h3>
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
    const exported = await readFile(result.path, "utf8");

    assert.equal(result.count, 1);
    assert.match(exported, /这是详情页正文第一段。/);
    assert.match(exported, /测试来源/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true, force: true });
  }
});

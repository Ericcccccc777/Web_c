const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { NoticeStore } = require("../src/storage/NoticeStore.js");
const { daysAgoISO } = require("../src/utils/date.js");

test("keeps only the requested old date for one day after a manual old-date run", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "notice-store-"));
  const store = new NoticeStore(path.join(dir, "notices.json"));
  const oldDate = daysAgoISO(40);
  const olderDifferentDate = daysAgoISO(41);
  const createdAt = new Date().toISOString();

  try {
    await store.recordRun({
      id: createdAt,
      date: oldDate,
      source: "manual",
      createdAt,
      results: [
        {
          notices: [
            { siteId: "demo", siteName: "测试站点", title: "保留的旧公告", date: oldDate, url: "https://example.com/a" },
            { siteId: "demo", siteName: "测试站点", title: "顺带解析的更旧公告", date: olderDifferentDate, url: "https://example.com/b" }
          ]
        }
      ]
    });

    const oldNotices = await store.noticesByDate(oldDate);
    const olderNotices = await store.noticesByDate(olderDifferentDate);

    assert.equal(oldNotices.length, 1);
    assert.equal(oldNotices[0].title, "保留的旧公告");
    assert.ok(oldNotices[0].expiresAt);
    assert.equal(olderNotices.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

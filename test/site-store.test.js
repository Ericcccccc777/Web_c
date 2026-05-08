const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { SiteStore } = require("../src/storage/SiteStore.js");

test("upserts editable site config", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "notice-sites-"));
  const store = new SiteStore(path.join(dir, "sites.json"));

  try {
    const saved = await store.upsert({
      name: "测试站点",
      url: "https://example.com/tzgg/",
      fetchUrl: "",
      pageCount: 3,
      titleKeywords: "关于，通知"
    });
    const sites = await store.list();

    const added = sites.find((site) => site.id === saved.id);

    assert.ok(added);
    assert.equal(added.pageCount, 3);
    assert.deepEqual(added.titleKeywords, ["关于", "通知"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deletes site config without touching other sites", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "notice-sites-"));
  const store = new SiteStore(path.join(dir, "sites.json"));

  try {
    const saved = await store.upsert({
      name: "待删除站点",
      url: "https://delete.example.com/tzgg/"
    });

    await store.delete(saved.id);

    const sites = await store.list();
    assert.equal(sites.some((site) => site.id === saved.id), false);
    assert.ok(sites.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { SettingsStore } = require("../src/storage/SettingsStore.js");

test("normalizes and persists schedule settings", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "notice-settings-"));
  const store = new SettingsStore(path.join(dir, "settings.json"));

  try {
    const saved = await store.save({
      scheduleTimes: ["14:00", "08:00", "invalid"],
      exportPath: "/tmp/notices"
    });
    const loaded = await store.load();

    assert.deepEqual(saved.scheduleTimes, ["08:00", "14:00"]);
    assert.deepEqual(loaded.scheduleTimes, ["08:00", "14:00"]);
    assert.equal(loaded.exportPath, "/tmp/notices");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

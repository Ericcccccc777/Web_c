import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { SettingsStore } from "../src/storage/SettingsStore.js";

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

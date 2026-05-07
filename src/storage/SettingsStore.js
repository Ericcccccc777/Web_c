import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_SETTINGS = {
  scheduleTimes: ["08:00", "14:00"],
  exportPath: path.join(os.homedir(), "Downloads")
};

export class SettingsStore {
  constructor(filePath = path.join(process.cwd(), "data", "settings.json")) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const data = JSON.parse(await readFile(this.filePath, "utf8"));
      return this.normalize(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return { ...DEFAULT_SETTINGS };
      }

      throw error;
    }
  }

  async save(input) {
    const settings = this.normalize(input);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return settings;
  }

  async update(input) {
    const current = await this.load();
    const next = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    return this.save({ ...current, ...next });
  }

  normalize(input = {}) {
    const scheduleTimes = this.normalizeScheduleTimes(input.scheduleTimes);
    const exportPath = String(input.exportPath || DEFAULT_SETTINGS.exportPath).trim() || DEFAULT_SETTINGS.exportPath;

    return {
      scheduleTimes,
      exportPath
    };
  }

  normalizeScheduleTimes(value) {
    const times = Array.isArray(value) ? value : DEFAULT_SETTINGS.scheduleTimes;
    const normalized = times
      .map((time) => String(time || "").trim())
      .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      .slice(0, 6);

    return normalized.length > 0 ? [...new Set(normalized)].sort() : DEFAULT_SETTINGS.scheduleTimes;
  }
}

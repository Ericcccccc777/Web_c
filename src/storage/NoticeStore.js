import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class NoticeStore {
  constructor(filePath = path.join(process.cwd(), "data", "notices.json")) {
    this.filePath = filePath;
  }

  async load() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") {
        return { notices: [], runs: [] };
      }

      throw error;
    }
  }

  async save(data) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  async recordRun(run) {
    const data = await this.load();
    const byKey = new Map(data.notices.map((notice) => [this.noticeKey(notice), notice]));

    for (const result of run.results) {
      for (const notice of result.notices) {
        byKey.set(this.noticeKey(notice), notice);
      }
    }

    data.notices = [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
    data.runs = [run, ...data.runs].slice(0, 80);
    await this.save(data);
    return data;
  }

  async noticesByDate(date) {
    const data = await this.load();
    return data.notices.filter((notice) => notice.date === date);
  }

  async latestRun() {
    const data = await this.load();
    return data.runs[0] || null;
  }

  noticeKey(notice) {
    return `${notice.siteId}:${notice.date}:${notice.title}`;
  }
}

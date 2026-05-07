import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { daysAgoISO, nowPlusDaysISO } from "../utils/date.js";

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
    const cutoffDate = daysAgoISO(30);
    const oldManualRun = run.date < cutoffDate;

    for (const result of run.results) {
      for (const notice of result.notices) {
        if (notice.date < cutoffDate && (!oldManualRun || notice.date !== run.date)) {
          continue;
        }

        byKey.set(this.noticeKey(notice), {
          ...notice,
          capturedAt: run.createdAt,
          capturedForDate: run.date,
          capturedSource: run.source || "manual",
          expiresAt: notice.date < cutoffDate ? nowPlusDaysISO(1) : ""
        });
      }
    }

    data.notices = this.cleanupNotices([...byKey.values()], cutoffDate).sort((a, b) => {
      const dateSort = b.date.localeCompare(a.date);
      return dateSort || (b.capturedAt || "").localeCompare(a.capturedAt || "");
    });
    data.runs = [run, ...data.runs].slice(0, 80);
    await this.save(data);
    return data;
  }

  async noticesByDate(date) {
    const data = await this.load();
    return this.cleanupNotices(data.notices).filter((notice) => notice.date === date);
  }

  async latestRun() {
    const data = await this.load();
    return data.runs[0] || null;
  }

  async archiveDates() {
    const data = await this.load();
    const byDate = new Map();

    for (const notice of this.cleanupNotices(data.notices)) {
      const item = byDate.get(notice.date) || { date: notice.date, count: 0, capturedAt: "" };
      item.count += 1;
      item.capturedAt = [item.capturedAt, notice.capturedAt || ""].sort().at(-1);
      byDate.set(notice.date, item);
    }

    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  async latestCaptureForDate(date) {
    const notices = await this.noticesByDate(date);
    return notices.map((notice) => notice.capturedAt || "").sort().at(-1) || "";
  }

  async cleanupExpired() {
    const data = await this.load();
    const notices = this.cleanupNotices(data.notices);

    if (notices.length !== data.notices.length) {
      data.notices = notices;
      await this.save(data);
    }

    return data;
  }

  noticeKey(notice) {
    return `${notice.siteId}:${notice.date}:${notice.title}`;
  }

  cleanupNotices(notices, cutoffDate = daysAgoISO(30)) {
    const now = new Date().toISOString();

    return notices.filter((notice) => {
      if (notice.date >= cutoffDate) {
        return true;
      }

      return notice.expiresAt && notice.expiresAt > now;
    });
  }
}

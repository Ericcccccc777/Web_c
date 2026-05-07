import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NoticeService } from "./services/NoticeService.js";
import { ExportService } from "./services/ExportService.js";
import { RunScheduler } from "./services/RunScheduler.js";
import { SettingsStore } from "./storage/SettingsStore.js";
import { isISODate, todayISO } from "./utils/date.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3333);
const settingsStore = new SettingsStore();
const service = new NoticeService();
const exporter = new ExportService({ noticeStore: service.store, settingsStore });
const scheduler = new RunScheduler({ service, settingsStore });

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/today", (_request, response) => {
  response.json({ date: todayISO() });
});

app.post("/api/run", async (request, response) => {
  const date = request.body?.date || todayISO();

  if (!isISODate(date)) {
    response.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
    return;
  }

  const run = await service.run(date);
  response.json(run);
});

app.get("/api/archive", async (request, response) => {
  const date = request.query.date || todayISO();

  if (!isISODate(date)) {
    response.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
    return;
  }

  response.json(await service.archive(date));
});

app.get("/api/archive/dates", async (_request, response) => {
  response.json(await service.archiveDates());
});

app.get("/api/settings", async (_request, response) => {
  response.json(await settingsStore.load());
});

app.put("/api/settings", async (request, response) => {
  try {
    const settings = await settingsStore.update({
      scheduleTimes: request.body?.scheduleTimes,
      exportPath: request.body?.exportPath
    });
    await scheduler.refresh();
    response.json(settings);
  } catch (error) {
    response.status(400).json({ error: error.message || "设置保存失败。" });
  }
});

app.post("/api/export", async (request, response) => {
  const date = request.body?.date || todayISO();

  if (!isISODate(date)) {
    response.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
    return;
  }

  try {
    response.json(
      await exporter.exportNotices({
        date,
        siteId: request.body?.siteId || "",
        noticeKeys: request.body?.noticeKeys,
        format: request.body?.format,
        filename: request.body?.filename,
        exportPath: request.body?.exportPath
      })
    );
  } catch (error) {
    response.status(400).json({ error: error.message || "导出失败。" });
  }
});

app.get("/api/sites", async (_request, response) => {
  response.json({ sites: await service.sites() });
});

app.post("/api/sites", async (request, response) => {
  try {
    response.json({ site: await service.saveSite(request.body) });
  } catch (error) {
    response.status(400).json({ error: error.message || "站点保存失败。" });
  }
});

app.delete("/api/sites/:siteId", async (request, response) => {
  try {
    await service.deleteSite(request.params.siteId);
    response.json({ ok: true });
  } catch (error) {
    response.status(404).json({ error: error.message || "站点删除失败。" });
  }
});

app.listen(port, async () => {
  console.log(`Local Notice Radar running at http://localhost:${port}`);
  await service.cleanupExpired();
  await scheduler.start();
});

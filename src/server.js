const express = require("express");
const { spawn } = require("node:child_process");
const net = require("node:net");
const { createInterface } = require("node:readline");
const path = require("node:path");
const { NoticeService } = require("./services/NoticeService.js");
const { ExportService } = require("./services/ExportService.js");
const { RunScheduler } = require("./services/RunScheduler.js");
const { SettingsStore } = require("./storage/SettingsStore.js");
const { isISODate, todayISO } = require("./utils/date.js");

const isPkg = Boolean(process.pkg);
const port = Number(process.env.PORT || 3333);
const url = `http://localhost:${port}`;

// pkg 模式下，工作目录切换到 exe 所在文件夹，使 data/ 目录写在 exe 旁边
if (isPkg) {
  process.chdir(path.dirname(process.execPath));
}

function isPortBusy(p) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(true));
    srv.once("listening", () => { srv.close(); resolve(false); });
    srv.listen(p);
  });
}

function openBrowser(target) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", target]]
      : process.platform === "darwin"
        ? ["open", [target]]
        : ["xdg-open", [target]];

  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function pauseAndExit(code) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\n按 Enter 键退出...", () => { rl.close(); process.exit(code); });
}

async function main() {
  // 防多开：端口已被占用则说明程序已在运行，打开浏览器后退出
  if (await isPortBusy(port)) {
    console.log("Notice Radar 已在运行，正在打开浏览器...");
    openBrowser(url);
    setTimeout(() => process.exit(0), 800);
    return;
  }

  const app = express();
  const settingsStore = new SettingsStore();
  const service = new NoticeService();
  const exporter = new ExportService({ noticeStore: service.store, settingsStore });
  const scheduler = new RunScheduler({ service, settingsStore });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/today", (_req, res) => {
    res.json({ date: todayISO() });
  });

  app.post("/api/run", async (req, res) => {
    const date = req.body?.date || todayISO();
    if (!isISODate(date)) {
      res.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
      return;
    }
    res.json(await service.run(date));
  });

  app.get("/api/archive", async (req, res) => {
    const date = req.query.date || todayISO();
    if (!isISODate(date)) {
      res.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
      return;
    }
    res.json(await service.archive(date));
  });

  app.get("/api/archive/dates", async (_req, res) => {
    res.json(await service.archiveDates());
  });

  app.get("/api/settings", async (_req, res) => {
    res.json(await settingsStore.load());
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const settings = await settingsStore.update({
        scheduleTimes: req.body?.scheduleTimes,
        exportPath: req.body?.exportPath
      });
      await scheduler.refresh();
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: error.message || "设置保存失败。" });
    }
  });

  app.post("/api/export", async (req, res) => {
    const date = req.body?.date || todayISO();
    if (!isISODate(date)) {
      res.status(400).json({ error: "日期格式必须是 YYYY-MM-DD。" });
      return;
    }
    try {
      res.json(
        await exporter.exportNotices({
          date,
          siteId: req.body?.siteId || "",
          noticeKeys: req.body?.noticeKeys,
          format: req.body?.format,
          filename: req.body?.filename,
          exportPath: req.body?.exportPath
        })
      );
    } catch (error) {
      res.status(400).json({ error: error.message || "导出失败。" });
    }
  });

  app.get("/api/sites", async (_req, res) => {
    res.json({ sites: await service.sites() });
  });

  app.post("/api/sites", async (req, res) => {
    try {
      res.json({ site: await service.saveSite(req.body) });
    } catch (error) {
      res.status(400).json({ error: error.message || "站点保存失败。" });
    }
  });

  app.delete("/api/sites/:siteId", async (req, res) => {
    try {
      await service.deleteSite(req.params.siteId);
      res.json({ ok: true });
    } catch (error) {
      res.status(404).json({ error: error.message || "站点删除失败。" });
    }
  });

  app.listen(port, () => {
    console.log(`Local Notice Radar 运行中: ${url}`);
    service.cleanupExpired();
    scheduler.start();
    if (isPkg || process.env.OPEN_BROWSER === "1") {
      openBrowser(url);
    }
  });
}

main().catch((err) => {
  console.error(`\n启动失败：${err.message}\n`);
  if (isPkg) {
    pauseAndExit(1);
  }
});

import { access } from "node:fs/promises";

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "src/server.js",
  "src/services/NoticeService.js",
  "src/crawlers/NoticeCrawler.js",
  "src/parsers/GovernmentNoticeParser.js",
  "src/storage/SiteStore.js"
];

for (const file of requiredFiles) {
  await access(file);
}

console.log("Build verification passed.");

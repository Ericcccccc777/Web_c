import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import * as cheerio from "cheerio";
import PDFDocument from "pdfkit";

export class ExportService {
  constructor({ noticeStore, settingsStore }) {
    this.noticeStore = noticeStore;
    this.settingsStore = settingsStore;
  }

  async exportNotices({ date, siteId = "", noticeKeys = [], format, filename, exportPath }) {
    const settings = await this.settingsStore.update({ exportPath });
    const selectedKeys = new Set(Array.isArray(noticeKeys) ? noticeKeys : []);
    const notices = (await this.noticeStore.noticesByDate(date)).filter((notice) => {
      if (selectedKeys.size > 0) {
        return selectedKeys.has(this.noticeKey(notice));
      }

      return !siteId || notice.siteId === siteId;
    });
    const posts = await Promise.all(notices.map((notice) => this.fetchPost(notice)));
    const normalizedFormat = format === "pdf" ? "pdf" : "word";
    const extension = normalizedFormat === "pdf" ? ".pdf" : ".word";
    const safeName = this.safeFilename(filename || `${date} 公告正文`);
    const outputPath = path.join(settings.exportPath, `${safeName}${extension}`);

    await mkdir(settings.exportPath, { recursive: true });

    if (normalizedFormat === "pdf") {
      await this.writePdf(outputPath, this.htmlDocument({ date, posts }));
    } else {
      await writeFile(outputPath, this.htmlDocument({ date, posts }), "utf8");
    }

    return {
      path: outputPath,
      format: normalizedFormat,
      count: notices.length
    };
  }

  async writePdf(outputPath, html) {
    const document = new PDFDocument({ margin: 48, size: "A4" });
    const stream = createWriteStream(outputPath);
    document.pipe(stream);
    this.applyPdfFont(document);
    this.writePdfContent(document, html);
    document.end();
    await finished(stream);
  }

  applyPdfFont(document) {
    const fontPath = [
      "/Library/Fonts/Arial Unicode.ttf",
      "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
      "/System/Library/Fonts/PingFang.ttc",
      "/System/Library/Fonts/Supplemental/Songti.ttc"
    ].find((item) => existsSync(item));

    if (fontPath) {
      document.font(fontPath);
    }
  }

  writePdfContent(document, html) {
    const title = html.match(/<h1>(.*?)<\/h1>/s)?.[1] || "公告正文";
    const meta = html.match(/<div class="meta">(.*?)<\/div>/s)?.[1] || "";
    const posts = [...html.matchAll(/<section class="post">\s*<h2>(.*?)<\/h2>\s*<div class="small">(.*?)<\/div>\s*<div class="small"><a href="(.*?)">.*?<\/a><\/div>\s*<div class="body">([\s\S]*?)<\/div>\s*<\/section>/g)];

    document.fontSize(20).fillColor("#1d1d1f").text(this.unescapeHtml(title), { lineGap: 4 });
    document.moveDown(0.4);
    document.fontSize(10).fillColor("#666666").text(this.unescapeHtml(meta));
    document.moveDown(0.8);

    if (posts.length === 0) {
      document.fontSize(12).fillColor("#1d1d1f").text("当前日期暂无公告。");
      return;
    }

    for (const [, postTitle, postMeta, postUrl, postBody] of posts) {
      document.moveTo(document.x, document.y).lineTo(545, document.y).strokeColor("#dddddd").stroke();
      document.moveDown(0.6);
      document.fontSize(14).fillColor("#1d1d1f").text(this.unescapeHtml(postTitle), { lineGap: 3 });
      document.moveDown(0.2);
      document.fontSize(9).fillColor("#666666").text(this.unescapeHtml(postMeta));
      document.fontSize(9).fillColor("#0057b8").text(this.unescapeHtml(postUrl), {
        link: this.unescapeHtml(postUrl),
        underline: false
      });
      document.moveDown(0.6);
      document.fontSize(11).fillColor("#1d1d1f").text(this.htmlToText(postBody), { lineGap: 4 });
      document.moveDown(0.8);
    }
  }

  htmlDocument({ date, posts }) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(date)} 公告正文</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; color: #1d1d1f; line-height: 1.55; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 19px; margin: 0 0 8px; }
    .meta { color: #666; margin-bottom: 18px; }
    .post { border-top: 1px solid #ddd; padding: 16px 0; }
    .body { margin-top: 14px; }
    .body p { margin: 0 0 10px; }
    .body table { border-collapse: collapse; width: 100%; }
    .body td, .body th { border: 1px solid #ddd; padding: 6px; }
    .small { color: #666; font-size: 12px; margin-top: 6px; }
    a { color: #0057b8; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(date)} 公告正文</h1>
  <div class="meta">共 ${posts.length} 篇，导出时间：${this.escapeHtml(new Date().toLocaleString("zh-CN"))}</div>
  ${posts.map((post) => this.postHtml(post)).join("") || "<p>当前日期暂无公告。</p>"}
</body>
</html>`;
  }

  postHtml(post) {
    return `<section class="post">
  <h2>${this.escapeHtml(post.title)}</h2>
  <div class="small">${this.escapeHtml(post.siteName)} · ${this.escapeHtml(post.date)}${post.source ? ` · ${this.escapeHtml(post.source)}` : ""}${post.publishTime ? ` · ${this.escapeHtml(post.publishTime)}` : ""}</div>
  <div class="small"><a href="${this.escapeAttr(post.url)}">${this.escapeHtml(post.url)}</a></div>
  <div class="body">${post.bodyHtml}</div>
</section>`;
  }

  async fetchPost(notice) {
    try {
      const response = await fetch(notice.url, {
        headers: {
          "user-agent": "LocalNoticeRadar/0.1 (+localhost personal monitor)",
          accept: "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return this.parsePost(notice, await response.text());
    } catch (error) {
      return {
        ...notice,
        publishTime: "",
        source: "",
        bodyHtml: `<p>正文抓取失败：${this.escapeHtml(error.message || "无法访问详情页。")}</p>`
      };
    }
  }

  parsePost(notice, html) {
    const $ = cheerio.load(html);
    const title = this.cleanText(
      $("meta[name='ArticleTitle']").attr("content") ||
        $(".zw-title").first().text() ||
        $("h1").first().text() ||
        notice.title
    );
    const publishTime = this.cleanText(
      $("meta[name='PubDate']").attr("content") ||
        $(".zw-info .time").first().text().replace(/^时间\s*:\s*/, "") ||
        ""
    );
    const source = this.cleanText(
      $("meta[name='ContentSource']").attr("content") ||
        $(".zw-info .ly").first().text().replace(/^来源\s*:\s*/, "") ||
        notice.siteName
    );
    const body = this.findBody($);

    body.find("script, style, iframe, object, embed, .shareIcon, .changeFont, .print").remove();
    body.find("img").each((_, element) => {
      const image = $(element);
      const src = image.attr("src");
      if (src) {
        image.attr("src", new URL(src, notice.url).toString());
      }
    });
    body.find("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href");
      if (href) {
        anchor.attr("href", new URL(href, notice.url).toString());
      }
    });

    const bodyHtml = body.html()?.trim() || `<p>${this.escapeHtml(this.cleanText($.root().text()).slice(0, 5000))}</p>`;

    return {
      ...notice,
      title,
      publishTime,
      source,
      bodyHtml
    };
  }

  findBody($) {
    const selectors = [".zw", ".TRS_Editor", ".article-content", ".content", ".main-content", "article", "main"];

    for (const selector of selectors) {
      const body = $(selector).first();
      if (this.cleanText(body.text()).length > 80) {
        return body.clone();
      }
    }

    return $("body").clone();
  }

  safeFilename(value) {
    return String(value)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\.(pdf|doc|docx|word)$/i, "")
      .slice(0, 80) || "公告列表";
  }

  noticeKey(notice) {
    return `${notice.siteId}:${notice.date}:${notice.title}`;
  }

  escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  escapeAttr(value) {
    return this.escapeHtml(value);
  }

  cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  htmlToText(html) {
    return this.cleanText(cheerio.load(`<div>${html}</div>`)("div").text());
  }

  unescapeHtml(value) {
    return String(value)
      .replaceAll("&quot;", '"')
      .replaceAll("&#039;", "'")
      .replaceAll("&gt;", ">")
      .replaceAll("&lt;", "<")
      .replaceAll("&amp;", "&");
  }
}

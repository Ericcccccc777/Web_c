const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const cheerio = require("cheerio");
const { Document, Packer, Paragraph, AlignmentType } = require("docx");

class ExportService {
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
    const safeName = this.safeFilename(filename || `${date} 公告正文`);
    const outputPath = path.join(settings.exportPath, `${safeName}.docx`);

    await mkdir(settings.exportPath, { recursive: true });
    await this.writeDocx(outputPath, date, posts);

    return {
      path: outputPath,
      format: "word",
      count: notices.length
    };
  }

  async writeDocx(outputPath, date, posts) {
    const paragraphs = [];

    paragraphs.push(
      new Paragraph({
        text: `${date} 公告正文`,
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      })
    );

    paragraphs.push(
      new Paragraph({
        text: `共 ${posts.length} 篇，导出时间：${new Date().toLocaleString("zh-CN")}`,
        size: 20,
        color: "666666",
        spacing: { after: 400 }
      })
    );

    if (posts.length === 0) {
      paragraphs.push(
        new Paragraph({
          text: "当前日期暂无公告。",
          size: 22
        })
      );
    } else {
      for (const post of posts) {
        paragraphs.push(
          new Paragraph({
            text: post.title,
            bold: true,
            size: 24,
            spacing: { before: 200, after: 100 }
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `${post.siteName} · ${post.date}${post.source ? ` · ${post.source}` : ""}${post.publishTime ? ` · ${post.publishTime}` : ""}`,
            size: 18,
            color: "666666",
            spacing: { after: 80 }
          })
        );

        paragraphs.push(
          new Paragraph({
            text: post.url,
            size: 18,
            color: "0057b8",
            spacing: { after: 200 }
          })
        );

        paragraphs.push(
          new Paragraph({
            text: this.htmlToText(post.bodyHtml),
            size: 22,
            spacing: { after: 200 }
          })
        );
      }
    }

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(outputPath, buffer);
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

module.exports = { ExportService };

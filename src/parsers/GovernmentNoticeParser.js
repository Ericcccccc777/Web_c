import * as cheerio from "cheerio";
import { URL } from "node:url";
import { Notice } from "../models/Notice.js";

const DATE_PATTERN = /20\d{2}-\d{2}-\d{2}/;

export class GovernmentNoticeParser {
  parse(site, html) {
    const $ = cheerio.load(html);
    const notices = [];
    const seen = new Set();

    $(site.listSelector || "a").each((_, element) => {
      const anchor = $(element);
      const title = this.cleanTitle(anchor.attr("title") || anchor.text());

      if (!this.isNoticeTitle(site, title)) {
        return;
      }

      const contextText = this.contextText($, anchor);
      const date = this.findDate(contextText);

      if (!date) {
        return;
      }

      const href = anchor.attr("href");
      const url = href ? new URL(href, site.url).toString() : site.url;
      const notice = new Notice({
        siteId: site.id,
        siteName: site.name,
        title,
        date,
        url
      });

      if (!seen.has(notice.key)) {
        notices.push(notice);
        seen.add(notice.key);
      }
    });

    return notices.sort((a, b) => b.date.localeCompare(a.date));
  }

  cleanTitle(value) {
    return value.replace(/^\s*\d+\s*/, "").replace(/\s+/g, " ").trim();
  }

  isNoticeTitle(site, title) {
    if (title.length < 8 || title.length > 180) {
      return false;
    }

    if (/首页|下一页|上一页|最后一页|第一页|政务公开|政务服务|网站地图/.test(title)) {
      return false;
    }

    if (!site.titleKeywords || site.titleKeywords.length === 0) {
      return true;
    }

    return site.titleKeywords.some((keyword) => title.includes(keyword));
  }

  contextText($, anchor) {
    const parent = anchor.closest("li, tr, div");
    const parentText = parent.length ? parent.text() : "";
    const siblingText = `${anchor.prev().text()} ${anchor.next().text()}`;
    return `${parentText} ${siblingText} ${anchor.text()}`;
  }

  findDate(text) {
    const match = text.match(DATE_PATTERN);
    return match ? match[0] : "";
  }
}

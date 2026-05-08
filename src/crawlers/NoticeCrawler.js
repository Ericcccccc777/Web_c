const { GovernmentNoticeParser } = require("../parsers/GovernmentNoticeParser.js");

class NoticeCrawler {
  constructor({ parser = new GovernmentNoticeParser(), timeoutMs = 30000 } = {}) {
    this.parser = parser;
    this.timeoutMs = timeoutMs;
  }

  async crawl(site) {
    const startedAt = new Date().toISOString();

    try {
      const pages = this.buildPageUrls(site);
      const pageResults = await Promise.allSettled(pages.map((url) => this.fetchHtml(url)));
      const notices = this.mergeNotices(
        pageResults
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => this.parser.parse(site, result.value))
      );
      const failedPages = pageResults.filter((result) => result.status === "rejected");

      if (notices.length === 0 && failedPages.length > 0) {
        throw failedPages[0].reason;
      }

      return {
        site,
        ok: notices.length > 0,
        notices,
        startedAt,
        finishedAt: new Date().toISOString(),
        message: this.resultMessage(notices, failedPages)
      };
    } catch (error) {
      return {
        site,
        ok: false,
        notices: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        message: this.errorMessage(error)
      };
    }
  }

  async fetchHtml(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "LocalNoticeRadar/0.1 (+localhost personal monitor)",
          accept: "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  buildPageUrls(site) {
    const baseUrl = site.fetchUrl || site.url;
    const pageCount = Math.min(Math.max(Number(site.pageCount || 1), 1), 10);

    return Array.from({ length: pageCount }, (_, index) => this.pageUrl(baseUrl, index + 1));
  }

  pageUrl(baseUrl, pageNumber) {
    if (pageNumber === 1) {
      return baseUrl;
    }

    const url = new URL(baseUrl);

    if (url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}index_${pageNumber}.html`;
      return url.toString();
    }

    url.pathname = url.pathname.replace(/index(?:_\d+)?\.html?$/i, `index_${pageNumber}.html`);
    return url.toString();
  }

  mergeNotices(notices) {
    const byKey = new Map();

    for (const notice of notices) {
      byKey.set(notice.key, notice);
    }

    return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  resultMessage(notices, failedPages) {
    if (notices.length === 0) {
      return "未解析到公告，可能是页面结构变化、当前列表为空，或分页地址规则不同。";
    }

    if (failedPages.length > 0) {
      return `已解析到公告，但有 ${failedPages.length} 个分页抓取失败，请人工确认。`;
    }

    return "";
  }

  errorMessage(error) {
    if (error.name === "AbortError" || /aborted/i.test(error.message || "")) {
      return `访问超时，${this.timeoutMs / 1000} 秒内没有完成抓取。请稍后重试，或在编辑站点里填写可访问的抓取地址。`;
    }

    if (error.cause?.code === "ENOTFOUND") {
      return "域名解析失败，请检查网址是否正确，或稍后重试。";
    }

    if (error.cause?.code === "ERR_SSL_BAD_ECPOINT" || /SSL|TLS|EPROTO/i.test(error.message || "")) {
      return "HTTPS 连接不兼容。可以尝试在编辑站点里把抓取地址改为对应的 HTTP 地址。";
    }

    return error.message || "爬取失败。";
  }
}

module.exports = { NoticeCrawler };

import { NoticeCrawler } from "../crawlers/NoticeCrawler.js";
import { SiteStore } from "../storage/SiteStore.js";
import { NoticeStore } from "../storage/NoticeStore.js";
import { todayISO } from "../utils/date.js";

export class NoticeService {
  constructor({ crawler = new NoticeCrawler(), store = new NoticeStore(), siteStore = new SiteStore() } = {}) {
    this.crawler = crawler;
    this.store = store;
    this.siteStore = siteStore;
  }

  async run(date = todayISO()) {
    const sites = await this.siteStore.list();
    const results = await Promise.all(sites.map((site) => this.crawler.crawl(site)));
    const notices = results.flatMap((result) => result.notices);
    const run = {
      id: new Date().toISOString(),
      date,
      results,
      noticesForDate: notices.filter((notice) => notice.date === date),
      warnings: this.buildWarnings(results, date),
      createdAt: new Date().toISOString()
    };

    await this.store.recordRun(run);
    return run;
  }

  async archive(date) {
    const notices = await this.store.noticesByDate(date);
    const latestRun = await this.store.latestRun();
    const sites = await this.siteStore.list();

    return {
      date,
      notices,
      latestRun,
      sites: sites.map((site) => this.publicSite(site))
    };
  }

  async sites() {
    const sites = await this.siteStore.list();
    return sites.map((site) => this.publicSite(site));
  }

  async saveSite(site) {
    return this.publicSite(await this.siteStore.upsert(site));
  }

  async deleteSite(siteId) {
    await this.siteStore.delete(siteId);
  }

  buildWarnings(results, date) {
    return results
      .map((result) => {
        if (!result.ok) {
          return {
            siteId: result.site.id,
            siteName: result.site.name,
            message: result.message || "爬取失败，请检查网站页面是否变化。"
          };
        }

        const countForDate = result.notices.filter((notice) => notice.date === date).length;
        if (countForDate === 0) {
          return {
            siteId: result.site.id,
            siteName: result.site.name,
            message: `未发现 ${date} 的公告，请人工确认该网站今天是否确实没有更新。`
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  publicSite(site) {
    return {
      id: site.id,
      name: site.name,
      url: site.url,
      fetchUrl: site.fetchUrl || "",
      listSelector: site.listSelector || "a",
      pageCount: site.pageCount || 1,
      titleKeywords: site.titleKeywords || []
    };
  }
}

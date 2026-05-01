import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultSites } from "../config/sites.js";

const DEFAULT_KEYWORDS = ["关于", "通知", "公告", "公示"];

export class SiteStore {
  constructor(filePath = path.join(process.cwd(), "data", "sites.json")) {
    this.filePath = filePath;
  }

  async list() {
    try {
      const data = JSON.parse(await readFile(this.filePath, "utf8"));
      return this.normalizeSites(data.sites || []);
    } catch (error) {
      if (error.code === "ENOENT") {
        return this.normalizeSites(defaultSites);
      }

      throw error;
    }
  }

  async upsert(siteInput) {
    const sites = await this.list();
    const site = this.normalizeSite(siteInput);
    const index = sites.findIndex((item) => item.id === site.id);

    if (index >= 0) {
      sites[index] = site;
    } else {
      sites.push(site);
    }

    await this.save(sites);
    return site;
  }

  async delete(siteId) {
    const sites = await this.list();
    const nextSites = sites.filter((site) => site.id !== siteId);

    if (nextSites.length === sites.length) {
      throw new Error("未找到要删除的站点。");
    }

    await this.save(nextSites);
  }

  async save(sites) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify({ sites: this.normalizeSites(sites) }, null, 2)}\n`, "utf8");
  }

  normalizeSites(sites) {
    return sites.map((site) => this.normalizeSite(site));
  }

  normalizeSite(site) {
    const name = String(site.name || "").trim();
    const url = String(site.url || "").trim();
    const fetchUrl = String(site.fetchUrl || "").trim();
    const listSelector = String(site.listSelector || "a").trim();
    const pageCount = this.normalizePageCount(site.pageCount);
    const titleKeywords = this.normalizeKeywords(site.titleKeywords);

    if (!name) {
      throw new Error("站点名称不能为空。");
    }

    this.assertUrl(url, "网页地址");

    if (fetchUrl) {
      this.assertUrl(fetchUrl, "抓取地址");
    }

    return {
      id: site.id || this.createId(name, url),
      name,
      url,
      fetchUrl,
      listSelector,
      pageCount,
      titleKeywords
    };
  }

  normalizePageCount(value) {
    const count = Number.parseInt(value, 10);

    if (Number.isNaN(count)) {
      return 1;
    }

    return Math.min(Math.max(count, 1), 10);
  }

  normalizeKeywords(value) {
    if (Array.isArray(value)) {
      const keywords = value.map((item) => String(item).trim()).filter(Boolean).slice(0, 16);
      return keywords.length > 0 ? keywords : DEFAULT_KEYWORDS;
    }

    const keywords = String(value || "")
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 16);

    return keywords.length > 0 ? keywords : DEFAULT_KEYWORDS;
  }

  assertUrl(value, label) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error(`${label}必须是 http 或 https 开头的有效地址。`);
    }
  }

  createId(name, url) {
    const base = `${name}-${url}`
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);

    return `${base || "site"}-${Date.now().toString(36)}`;
  }
}

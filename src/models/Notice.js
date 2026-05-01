export class Notice {
  constructor({ siteId, siteName, title, date, url }) {
    this.siteId = siteId;
    this.siteName = siteName;
    this.title = title;
    this.date = date;
    this.url = url;
  }

  get key() {
    return `${this.siteId}:${this.date}:${this.title}`;
  }
}

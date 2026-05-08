const defaultSites = [
  {
    id: "sz-stic",
    name: "深圳市科技创新局",
    url: "https://stic.sz.gov.cn/xxgk/tzgg/index.html",
    fetchUrl: "http://stic.sz.gov.cn/xxgk/tzgg/index.html",
    listSelector: "a",
    pageCount: 1,
    titleKeywords: ["深圳市科技创新局", "深圳市科技创新委员会", "关于", "通知", "公示", "公告", "目录"]
  },
  {
    id: "sz-gxj",
    name: "深圳市工业和信息化局",
    url: "https://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/",
    fetchUrl: "http://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/",
    listSelector: "a",
    pageCount: 1,
    titleKeywords: ["工业和信息化局", "关于", "通知", "公示", "公告", "征集", "规程"]
  },
  {
    id: "gd-stc",
    name: "广东省科学技术厅",
    url: "https://gdstc.gd.gov.cn/zwgk_n/tzgg/index.html",
    listSelector: "a",
    pageCount: 1,
    titleKeywords: ["广东省科学技术厅", "关于", "通知", "公示", "公告", "报告"]
  }
];

module.exports = { defaultSites };

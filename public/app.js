const state = {
  selectedDate: "",
  sites: [],
  latestRun: null
};

const elements = {
  runButton: document.querySelector("#runButton"),
  datePicker: document.querySelector("#datePicker"),
  lastRun: document.querySelector("#lastRun"),
  summary: document.querySelector("#summary"),
  resultTitle: document.querySelector("#resultTitle"),
  noticeCount: document.querySelector("#noticeCount"),
  noticeList: document.querySelector("#noticeList"),
  warningList: document.querySelector("#warningList"),
  siteList: document.querySelector("#siteList"),
  addSiteButton: document.querySelector("#addSiteButton"),
  siteModal: document.querySelector("#siteModal"),
  siteForm: document.querySelector("#siteForm"),
  siteFormTitle: document.querySelector("#siteFormTitle"),
  closeSiteModal: document.querySelector("#closeSiteModal"),
  cancelSiteForm: document.querySelector("#cancelSiteForm"),
  deleteSiteButton: document.querySelector("#deleteSiteButton"),
  siteFormError: document.querySelector("#siteFormError"),
  siteId: document.querySelector("#siteId"),
  siteName: document.querySelector("#siteName"),
  siteUrl: document.querySelector("#siteUrl"),
  siteFetchUrl: document.querySelector("#siteFetchUrl"),
  siteKeywords: document.querySelector("#siteKeywords"),
  sitePageCount: document.querySelector("#sitePageCount")
};

async function init() {
  const today = await getJson("/api/today");
  state.selectedDate = today.date;
  elements.datePicker.value = today.date;

  await loadArchive(today.date);
  bindEvents();
}

function bindEvents() {
  elements.runButton.addEventListener("click", runCrawler);
  elements.addSiteButton.addEventListener("click", () => openSiteForm());
  elements.closeSiteModal.addEventListener("click", closeSiteForm);
  elements.cancelSiteForm.addEventListener("click", closeSiteForm);
  elements.deleteSiteButton.addEventListener("click", deleteCurrentSite);
  elements.siteForm.addEventListener("submit", saveSite);
  elements.datePicker.addEventListener("change", async (event) => {
    state.selectedDate = event.target.value;
    await loadArchive(state.selectedDate);
  });
  elements.siteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-site]");
    if (!button) {
      return;
    }

    const site = state.sites.find((item) => item.id === button.dataset.editSite);
    if (site) {
      openSiteForm(site);
    }
  });
}

async function runCrawler() {
  setLoading(true);

  try {
    const run = await postJson("/api/run", { date: state.selectedDate });
    state.latestRun = run;
    renderRun(run);
  } catch (error) {
    renderWarnings([{ siteName: "运行失败", message: error.message }]);
  } finally {
    setLoading(false);
  }
}

async function loadArchive(date) {
  const archive = await getJson(`/api/archive?date=${encodeURIComponent(date)}`);
  state.sites = archive.sites;
  state.latestRun = archive.latestRun;
  renderArchive(archive);
}

function renderRun(run) {
  const notices = run.noticesForDate;
  renderNotices(notices, run.date);
  renderWarnings(run.warnings);
  renderSites(run.results);
  renderMeta({
    date: run.date,
    count: notices.length,
    latestRun: run.createdAt,
    warningCount: run.warnings.length
  });
}

function renderArchive(archive) {
  renderNotices(archive.notices, archive.date);
  renderWarnings([]);
  renderSitesFromArchive(archive.sites, archive.notices, archive.latestRun);
  renderMeta({
    date: archive.date,
    count: archive.notices.length,
    latestRun: archive.latestRun?.createdAt || "",
    warningCount: 0
  });
}

function renderNotices(notices, date) {
  elements.resultTitle.textContent = `${date} 公告列表`;
  elements.noticeCount.textContent = `${notices.length} 条`;

  if (notices.length === 0) {
    elements.noticeList.className = "notice-list empty-state";
    elements.noticeList.textContent = "当前日期暂无已存储公告。点击运行可抓取最新列表并自动归档。";
    return;
  }

  elements.noticeList.className = "notice-list";
  elements.noticeList.innerHTML = notices.map((notice) => noticeTemplate(notice)).join("");
}

function noticeTemplate(notice) {
  return `
    <article class="notice-card">
      <a href="${escapeAttr(notice.url)}" target="_blank" rel="noreferrer">${escapeHtml(notice.title)}</a>
      <div class="notice-meta">
        <span>${escapeHtml(notice.siteName)}</span>
        <span>${escapeHtml(notice.date)}</span>
      </div>
    </article>
  `;
}

function renderWarnings(warnings) {
  if (!warnings.length) {
    elements.warningList.innerHTML = "";
    return;
  }

  elements.warningList.innerHTML = warnings
    .map((warning) => `<div class="warning">${escapeHtml(warning.siteName)}：${escapeHtml(warning.message)}</div>`)
    .join("");
}

function renderSites(results) {
  elements.siteList.innerHTML = results
    .map((result) => {
      const count = result.notices.filter((notice) => notice.date === state.selectedDate).length;
      const status = siteRunStatus(result, count);
      const className = result.ok && count > 0 ? "site-status" : "site-status error";

      return siteTemplate(result.site, status, className);
    })
    .join("");
}

function renderSitesFromArchive(sites, notices, latestRun) {
  elements.siteList.innerHTML = sites
    .map((site) => {
      const count = notices.filter((notice) => notice.siteId === site.id).length;
      const latestResult = latestRun?.results?.find((result) => result.site.id === site.id);
      const isExpired = latestResult && !latestResult.ok;
      const status = isExpired ? "已失效" : count > 0 ? `已归档 ${count} 条` : "无归档";
      const className = isExpired ? "site-status error" : count > 0 ? "site-status" : "site-status muted";

      return siteTemplate(site, status, className);
    })
    .join("");
}

function siteRunStatus(result, count) {
  if (!result.ok) {
    return "已失效";
  }

  return count > 0 ? `${count} 条` : "需确认";
}

function siteTemplate(site, status, className) {
  return `
    <div class="site-item">
      <div class="site-title-row">
        <p class="site-name">${escapeHtml(site.name)}</p>
        <button class="edit-site-button" type="button" data-edit-site="${escapeAttr(site.id)}">编辑</button>
      </div>
      <a class="site-url" href="${escapeAttr(site.url)}" target="_blank" rel="noreferrer">${escapeHtml(site.url)}</a>
      <span class="${className}">${escapeHtml(status)}</span>
    </div>
  `;
}

function openSiteForm(site = null) {
  elements.siteForm.reset();
  elements.siteFormError.textContent = "";
  elements.siteFormTitle.textContent = site ? "编辑站点" : "添加站点";
  elements.siteId.value = site?.id || "";
  elements.siteName.value = site?.name || "";
  elements.siteUrl.value = site?.url || "";
  elements.siteFetchUrl.value = site?.fetchUrl || "";
  elements.siteKeywords.value = (site?.titleKeywords || ["关于", "通知", "公告", "公示"]).join("，");
  elements.sitePageCount.value = site?.pageCount || 1;
  elements.deleteSiteButton.hidden = !site;
  elements.siteModal.hidden = false;
  elements.siteName.focus();
}

function closeSiteForm() {
  elements.siteModal.hidden = true;
}

async function saveSite(event) {
  event.preventDefault();
  elements.siteFormError.textContent = "";

  try {
    await postJson("/api/sites", {
      id: elements.siteId.value || undefined,
      name: elements.siteName.value,
      url: elements.siteUrl.value,
      fetchUrl: elements.siteFetchUrl.value,
      titleKeywords: elements.siteKeywords.value,
      pageCount: elements.sitePageCount.value
    });
    closeSiteForm();
    await loadArchive(state.selectedDate);
  } catch (error) {
    elements.siteFormError.textContent = error.message;
  }
}

async function deleteCurrentSite() {
  const site = state.sites.find((item) => item.id === elements.siteId.value);

  if (!site) {
    return;
  }

  const confirmed = window.confirm(`确定删除“${site.name}”吗？这只会删除站点配置，不会删除已归档公告。`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteJson(`/api/sites/${encodeURIComponent(site.id)}`);
    closeSiteForm();
    await loadArchive(state.selectedDate);
  } catch (error) {
    elements.siteFormError.textContent = error.message;
  }
}

function renderMeta({ count, latestRun, warningCount }) {
  elements.lastRun.textContent = latestRun ? formatDateTime(latestRun) : "尚未运行";
  elements.summary.textContent = warningCount > 0 ? `${count} 条，${warningCount} 个提示` : `${count} 条`;
}

function setLoading(isLoading) {
  elements.runButton.disabled = isLoading;
  elements.runButton.lastChild.textContent = isLoading ? " 运行中" : " 运行";
}

async function getJson(url) {
  const response = await fetch(url);
  return parseJsonResponse(response);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseJsonResponse(response);
}

async function deleteJson(url) {
  const response = await fetch(url, { method: "DELETE" });
  return parseJsonResponse(response);
}

async function parseJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "请求失败。");
  }

  return data;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init();

const state = {
  selectedDate: "",
  sites: [],
  latestRun: null,
  notices: [],
  activeSiteId: "",
  warningCount: 0,
  capturedAt: "",
  archiveDates: [],
  settings: null,
  batchSelecting: false,
  selectedNoticeKeys: new Set(),
  exportNoticeKeys: []
};

const elements = {
  runButton: document.querySelector("#runButton"),
  datePicker: document.querySelector("#datePicker"),
  datePickerButton: document.querySelector("#datePickerButton"),
  datePickerText: document.querySelector("#datePickerText"),
  dateArchivePanel: document.querySelector("#dateArchivePanel"),
  dateArchiveList: document.querySelector("#dateArchiveList"),
  scheduleMorning: document.querySelector("#scheduleMorning"),
  scheduleAfternoon: document.querySelector("#scheduleAfternoon"),
  saveScheduleButton: document.querySelector("#saveScheduleButton"),
  summary: document.querySelector("#summary"),
  resultTitle: document.querySelector("#resultTitle"),
  captureTime: document.querySelector("#captureTime"),
  noticeCount: document.querySelector("#noticeCount"),
  noticeList: document.querySelector("#noticeList"),
  warningList: document.querySelector("#warningList"),
  exportButton: document.querySelector("#exportButton"),
  batchExportBar: document.querySelector("#batchExportBar"),
  batchExportCount: document.querySelector("#batchExportCount"),
  cancelBatchExportButton: document.querySelector("#cancelBatchExportButton"),
  confirmBatchExportButton: document.querySelector("#confirmBatchExportButton"),
  exportModal: document.querySelector("#exportModal"),
  exportForm: document.querySelector("#exportForm"),
  closeExportModal: document.querySelector("#closeExportModal"),
  cancelExportForm: document.querySelector("#cancelExportForm"),
  exportFilename: document.querySelector("#exportFilename"),
  exportSuffix: document.querySelector("#exportSuffix"),
  exportPath: document.querySelector("#exportPath"),
  exportFormError: document.querySelector("#exportFormError"),
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
  elements.datePickerText.textContent = today.date;

  await loadSettings();
  await loadArchiveDates();
  await loadArchive(today.date);
  bindEvents();
}

function bindEvents() {
  elements.runButton.addEventListener("click", runCrawler);
  elements.datePickerButton.addEventListener("click", toggleDateArchivePanel);
  document.addEventListener("click", closeDateArchivePanelOnOutsideClick);
  elements.saveScheduleButton.addEventListener("click", saveSchedule);
  elements.scheduleMorning.addEventListener("input", updateScheduleButtonState);
  elements.scheduleAfternoon.addEventListener("input", updateScheduleButtonState);
  elements.exportButton.addEventListener("click", startBatchExport);
  elements.cancelBatchExportButton.addEventListener("click", cancelBatchExport);
  elements.confirmBatchExportButton.addEventListener("click", confirmBatchExport);
  elements.closeExportModal.addEventListener("click", closeExportForm);
  elements.cancelExportForm.addEventListener("click", closeExportForm);
  elements.exportForm.addEventListener("submit", exportCurrentNotices);
  elements.exportForm.addEventListener("change", updateExportSuffix);
  elements.noticeList.addEventListener("click", (event) => {
    const exportButton = event.target.closest("[data-export-notice]");
    if (exportButton) {
      openExportForm([exportButton.dataset.exportNotice]);
      return;
    }

    if (!state.batchSelecting || event.target.closest("a, button")) {
      return;
    }

    const card = event.target.closest("[data-notice-key]");
    if (card) {
      toggleBatchNotice(card.dataset.noticeKey);
    }
  });
  elements.addSiteButton.addEventListener("click", () => openSiteForm());
  elements.closeSiteModal.addEventListener("click", closeSiteForm);
  elements.cancelSiteForm.addEventListener("click", closeSiteForm);
  elements.deleteSiteButton.addEventListener("click", deleteCurrentSite);
  elements.siteForm.addEventListener("submit", saveSite);
  elements.datePicker.addEventListener("change", async (event) => {
    state.selectedDate = event.target.value;
    elements.datePickerText.textContent = state.selectedDate;
    elements.dateArchivePanel.hidden = true;
    await loadArchive(state.selectedDate);
    renderArchiveDates();
  });
  elements.dateArchiveList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-archive-date]");
    if (!button) {
      return;
    }

    await selectDate(button.dataset.archiveDate);
  });
  elements.siteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-site]");
    if (button) {
      const site = state.sites.find((item) => item.id === button.dataset.editSite);
      if (site) {
        openSiteForm(site);
      }
      return;
    }

    if (event.target.closest("a")) {
      return;
    }

    const siteItem = event.target.closest("[data-filter-site]");
    if (siteItem) {
      toggleSiteFilter(siteItem.dataset.filterSite);
    }
  });
  elements.siteList.addEventListener("keydown", (event) => {
    if (event.target.closest("a, button")) {
      return;
    }

    const siteItem = event.target.closest("[data-filter-site]");
    if (siteItem && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleSiteFilter(siteItem.dataset.filterSite);
    }
  });
}

async function runCrawler() {
  setLoading(true);

  try {
    const run = await postJson("/api/run", { date: state.selectedDate });
    state.latestRun = run;
    state.notices = run.noticesForDate;
    state.warningCount = run.warnings.length;
    state.capturedAt = run.createdAt;
    renderRun(run);
    await loadArchiveDates();
  } catch (error) {
    renderWarnings([{ siteName: "运行失败", message: error.message }]);
  } finally {
    setLoading(false);
  }
}

async function loadSettings() {
  state.settings = await getJson("/api/settings");
  elements.scheduleMorning.value = state.settings.scheduleTimes[0] || "08:00";
  elements.scheduleAfternoon.value = state.settings.scheduleTimes[1] || "14:00";
  elements.exportPath.value = state.settings.exportPath;
  updateScheduleButtonState();
}

async function loadArchiveDates() {
  const archive = await getJson("/api/archive/dates");
  state.archiveDates = archive.dates;
  renderArchiveDates();
}

async function loadArchive(date) {
  const archive = await getJson(`/api/archive?date=${encodeURIComponent(date)}`);
  state.sites = archive.sites;
  state.latestRun = archive.latestRun;
  state.notices = archive.notices;
  state.warningCount = 0;
  state.capturedAt = archive.capturedAt || "";
  renderArchive(archive);
}

function renderRun(run) {
  const notices = filteredNotices();
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
  const notices = filteredNotices();
  renderNotices(notices, archive.date);
  renderWarnings([]);
  renderSitesFromArchive(archive.sites, archive.notices, archive.latestRun);
  renderMeta({
    date: archive.date,
    count: notices.length,
    latestRun: archive.latestRun?.createdAt || "",
    warningCount: 0
  });
}

function renderNotices(notices, date) {
  const activeSite = selectedSite();
  const visibleNoticeKeys = new Set(notices.map((notice) => noticeKey(notice)));
  state.selectedNoticeKeys = new Set([...state.selectedNoticeKeys].filter((key) => visibleNoticeKeys.has(key)));
  elements.resultTitle.textContent = activeSite ? `${date} ${activeSite.name}` : `${date} 公告列表`;
  elements.noticeCount.textContent = `${notices.length} 条`;
  elements.captureTime.textContent = captureTimeText(notices.length);
  syncBatchExportBar();

  if (notices.length === 0) {
    elements.noticeList.className = "notice-list empty-state";
    elements.noticeList.textContent = activeSite
      ? "当前日期下，这个站点暂无已存储公告。再次点击站点可回到全部站点。"
      : "当前日期暂无已存储公告。点击运行可抓取最新列表并自动归档。";
    return;
  }

  elements.noticeList.className = "notice-list";
  elements.noticeList.innerHTML = notices.map((notice) => noticeTemplate(notice)).join("");
}

function noticeTemplate(notice) {
  const key = noticeKey(notice);
  const isSelected = state.selectedNoticeKeys.has(key);

  return `
    <article class="notice-card${state.batchSelecting ? " selectable" : ""}${isSelected ? " selected" : ""}" data-notice-key="${escapeAttr(key)}">
      <a href="${escapeAttr(notice.url)}" target="_blank" rel="noreferrer">${escapeHtml(notice.title)}</a>
      <div class="notice-meta">
        <span>${escapeHtml(notice.siteName)}</span>
        <span>${escapeHtml(notice.date)}</span>
      </div>
      <div class="notice-actions">
        <button class="secondary-button compact-button" type="button" data-export-notice="${escapeAttr(key)}">导出</button>
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
  syncActiveSiteSelection();
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
  syncActiveSiteSelection();
}

function siteRunStatus(result, count) {
  if (!result.ok) {
    return "已失效";
  }

  return count > 0 ? `${count} 条` : "需确认";
}

function siteTemplate(site, status, className) {
  const isActive = state.activeSiteId === site.id;

  return `
    <div class="site-item${isActive ? " active" : ""}" data-filter-site="${escapeAttr(site.id)}" role="button" tabindex="0" aria-pressed="${isActive}">
      <div class="site-title-row">
        <p class="site-name">${escapeHtml(site.name)}</p>
        <button class="edit-site-button" type="button" data-edit-site="${escapeAttr(site.id)}">编辑</button>
      </div>
      <a class="site-url" href="${escapeAttr(site.url)}" target="_blank" rel="noreferrer">${escapeHtml(site.url)}</a>
      <span class="${className}">${escapeHtml(status)}</span>
    </div>
  `;
}

function toggleSiteFilter(siteId) {
  state.activeSiteId = state.activeSiteId === siteId ? "" : siteId;
  renderFilteredNoticeView();
  syncActiveSiteSelection();
}

function renderFilteredNoticeView() {
  const notices = filteredNotices();
  renderNotices(notices, state.selectedDate);
  renderMeta({
    count: notices.length,
    warningCount: state.warningCount
  });
}

function filteredNotices() {
  if (!state.activeSiteId) {
    return state.notices;
  }

  return state.notices.filter((notice) => notice.siteId === state.activeSiteId);
}

function selectedSite() {
  return state.sites.find((site) => site.id === state.activeSiteId);
}

function syncActiveSiteSelection() {
  for (const item of elements.siteList.querySelectorAll("[data-filter-site]")) {
    const isActive = item.dataset.filterSite === state.activeSiteId;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  }
}

function toggleDateArchivePanel() {
  elements.dateArchivePanel.hidden = !elements.dateArchivePanel.hidden;
}

function closeDateArchivePanelOnOutsideClick(event) {
  if (
    elements.dateArchivePanel.hidden ||
    elements.dateArchivePanel.contains(event.target) ||
    elements.datePickerButton.contains(event.target)
  ) {
    return;
  }

  elements.dateArchivePanel.hidden = true;
}

async function selectDate(date) {
  state.selectedDate = date;
  elements.datePicker.value = date;
  elements.datePickerText.textContent = date;
  elements.dateArchivePanel.hidden = true;
  await loadArchive(date);
  renderArchiveDates();
}

function renderArchiveDates() {
  if (state.archiveDates.length === 0) {
    elements.dateArchiveList.className = "date-archive-list empty-date-list";
    elements.dateArchiveList.textContent = "还没有已归档日期。";
    return;
  }

  elements.dateArchiveList.className = "date-archive-list";
  elements.dateArchiveList.innerHTML = state.archiveDates
    .map((item) => {
      const isActive = item.date === state.selectedDate;
      return `
        <button class="archive-date-item${isActive ? " active" : ""}" type="button" data-archive-date="${escapeAttr(item.date)}">
          <span>${escapeHtml(item.date)}</span>
          <strong>${item.count} 条</strong>
        </button>
      `;
    })
    .join("");
}

async function saveSchedule() {
  const scheduleTimes = [elements.scheduleMorning.value, elements.scheduleAfternoon.value].filter(Boolean);
  elements.saveScheduleButton.disabled = true;

  try {
    state.settings = await putJson("/api/settings", {
      ...state.settings,
      scheduleTimes
    });
    elements.scheduleMorning.value = state.settings.scheduleTimes[0] || "08:00";
    elements.scheduleAfternoon.value = state.settings.scheduleTimes[1] || "14:00";
    updateScheduleButtonState();
    elements.summary.textContent = "自动抓取时间已保存";
  } catch (error) {
    elements.summary.textContent = error.message;
  } finally {
    updateScheduleButtonState();
  }
}

function updateScheduleButtonState() {
  const current = [elements.scheduleMorning.value, elements.scheduleAfternoon.value].filter(Boolean).sort();
  const saved = [...(state.settings?.scheduleTimes || [])].sort();
  const changed = current.join("|") !== saved.join("|");

  elements.saveScheduleButton.textContent = "更改";
  elements.saveScheduleButton.disabled = !changed;
}

function openExportForm(noticeKeys = []) {
  state.exportNoticeKeys = noticeKeys;
  elements.exportForm.reset();
  elements.exportFormError.textContent = "";
  elements.exportFilename.value = exportDefaultFilename();
  elements.exportPath.value = state.settings?.exportPath || elements.exportPath.value;
  updateExportSuffix();
  elements.exportModal.hidden = false;
  elements.exportFilename.focus();
}

function closeExportForm() {
  elements.exportModal.hidden = true;
  state.exportNoticeKeys = [];
}

function updateExportSuffix() {
  elements.exportSuffix.textContent = selectedExportFormat() === "pdf" ? ".pdf" : ".word";
}

async function exportCurrentNotices(event) {
  event.preventDefault();
  elements.exportFormError.textContent = "";

  try {
    const result = await postJson("/api/export", {
      date: state.selectedDate,
      siteId: state.activeSiteId,
      noticeKeys: state.exportNoticeKeys,
      format: selectedExportFormat(),
      filename: elements.exportFilename.value,
      exportPath: elements.exportPath.value
    });
    state.settings = {
      ...state.settings,
      exportPath: elements.exportPath.value
    };
    closeExportForm();
    elements.summary.textContent = `已导出 ${result.count} 条`;
    cancelBatchExport();
  } catch (error) {
    elements.exportFormError.textContent = error.message;
  }
}

function selectedExportFormat() {
  return new FormData(elements.exportForm).get("exportFormat");
}

function exportDefaultFilename() {
  const activeSite = selectedSite();
  if (state.exportNoticeKeys.length === 1) {
    const notice = state.notices.find((item) => noticeKey(item) === state.exportNoticeKeys[0]);
    return notice ? `${notice.date}-${notice.title}` : `${state.selectedDate}-公告`;
  }

  if (state.exportNoticeKeys.length > 1) {
    return `${state.selectedDate}-已选公告`;
  }

  return activeSite ? `${state.selectedDate}-${activeSite.name}-公告列表` : `${state.selectedDate}-公告列表`;
}

function startBatchExport() {
  state.batchSelecting = true;
  state.selectedNoticeKeys.clear();
  renderNotices(filteredNotices(), state.selectedDate);
}

function cancelBatchExport() {
  if (!state.batchSelecting && state.selectedNoticeKeys.size === 0) {
    return;
  }

  state.batchSelecting = false;
  state.selectedNoticeKeys.clear();
  renderNotices(filteredNotices(), state.selectedDate);
}

function confirmBatchExport() {
  if (state.selectedNoticeKeys.size === 0) {
    return;
  }

  openExportForm([...state.selectedNoticeKeys]);
}

function toggleBatchNotice(key) {
  if (state.selectedNoticeKeys.has(key)) {
    state.selectedNoticeKeys.delete(key);
  } else {
    state.selectedNoticeKeys.add(key);
  }

  renderNotices(filteredNotices(), state.selectedDate);
}

function syncBatchExportBar() {
  elements.batchExportBar.hidden = !state.batchSelecting;
  elements.batchExportCount.textContent = `已选择 ${state.selectedNoticeKeys.size} 条`;
  elements.confirmBatchExportButton.disabled = state.selectedNoticeKeys.size === 0;
  elements.exportButton.disabled = state.batchSelecting;
}

function noticeKey(notice) {
  return `${notice.siteId}:${notice.date}:${notice.title}`;
}

function captureTimeText(noticeCount) {
  if (state.capturedAt) {
    return `抓取时间：${formatDateTime(state.capturedAt)}`;
  }

  return noticeCount > 0 ? "旧归档未记录抓取时间" : "尚无抓取记录";
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
    if (state.activeSiteId === site.id) {
      state.activeSiteId = "";
    }
    closeSiteForm();
    await loadArchive(state.selectedDate);
  } catch (error) {
    elements.siteFormError.textContent = error.message;
  }
}

function renderMeta({ count, warningCount }) {
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

async function putJson(url, body) {
  const response = await fetch(url, {
    method: "PUT",
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

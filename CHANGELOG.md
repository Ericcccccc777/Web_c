# 更新日志

## 2026-05-01 更新记录

- 需求说明：创建一个可在 macOS 和 Windows 本地运行的 localhost 公告收集 MVP。
- 修改内容：新增模块化 Node.js/Express 项目、公告爬虫、解析器、本地存储、苹果风格前端页面、日期查看、失败提示和 GitHub Actions CI。
- 涉及模块：`src/`、`public/`、`scripts/`、`.github/workflows/ci.yml`、`package.json`、`README.md`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已启动本地服务并完成浏览器检查；真实抓取三个示例网站成功，`2026-05-01` 无当天公告时会显示红色人工确认提示，`2026-04-30` 可从归档读取 7 条公告。
- GitHub 状态：尚未上传。
- 已知问题：当前 MVP 抓取首页列表，历史日期只能查看已通过运行归档过的数据。

## 2026-05-01 站点状态文案修正

- 需求说明：历史日期切换时，站点状态不应继续显示“待运行”造成误解。
- 修改内容：归档日期视图按当前日期显示“已归档 X 条”或“无归档”；运行后仍显示当次检查结果和需确认提示。
- 涉及模块：`public/app.js`、`public/styles.css`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已在浏览器验证 `2026-04-30` 显示各站点归档数量。
- GitHub 状态：尚未上传。
- 已知问题：无。

## 2026-05-01 站点管理更新

- 需求说明：将右侧站点状态区域改为可添加、可编辑网页的站点管理区域。
- 修改内容：新增站点管理 UI、添加/编辑弹窗、本地站点配置存储、站点 API、站点存储测试。
- 涉及模块：`public/index.html`、`public/app.js`、`public/styles.css`、`src/storage/SiteStore.js`、`src/services/NoticeService.js`、`src/server.js`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已在浏览器验证添加弹窗和编辑弹窗可打开。
- GitHub 状态：尚未上传。
- 已知问题：当前只支持添加和编辑，不提供删除按钮。

## 2026-05-01 爬虫超时提示优化

- 需求说明：新增广东省发改委后偶发显示英文 `This operation was aborted`，需要解释并优化。
- 修改内容：抓取超时时间从 12 秒提高到 30 秒，超时、DNS、HTTPS/TLS 错误改为中文提示。
- 涉及模块：`src/crawlers/NoticeCrawler.js`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已确认广东省发改委页面可访问并能解析公告。
- GitHub 状态：尚未上传。
- 已知问题：如果目标网站偶发很慢，仍可能需要稍后重试。

## 2026-05-01 自动翻页抓取

- 需求说明：部分公告列表翻页后，较早日期的信息无法从第一页抓取。
- 修改内容：站点编辑表单新增“抓取页数”，爬虫自动尝试 `index.html`、`index_2.html`、`index_3.html` 等分页并合并去重。
- 涉及模块：`src/crawlers/NoticeCrawler.js`、`src/storage/SiteStore.js`、`src/config/sites.js`、`public/index.html`、`public/app.js`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已将广东省发改委设置为抓取 2 页并真实运行，确认第二页可抓取；`2026-04-10` 在该站点列表中确实无公告。
- GitHub 状态：尚未上传。
- 已知问题：当前自动分页适用于常见 `index_2.html` 规则；特殊分页规则后续可单独扩展。

## 2026-05-01 站点删除与失效状态

- 需求说明：站点管理编辑中增加删除按钮，并在网页失效时显示“已失效”。
- 修改内容：新增站点删除 API、编辑弹窗删除按钮、删除前确认、最近运行失败状态显示为“已失效”。
- 涉及模块：`src/storage/SiteStore.js`、`src/services/NoticeService.js`、`src/server.js`、`public/index.html`、`public/app.js`、`public/styles.css`。
- 自动化测试：已通过 `npm test` 和 `npm run build`。
- 人工测试：已用临时无效站点验证失败状态，再删除测试站点。
- GitHub 状态：尚未上传。
- 已知问题：删除只删除站点配置，不清理历史归档数据。

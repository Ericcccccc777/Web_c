# 修复记录（2026-05-08）

## 问题：Windows exe 双击闪退

排查了 5 层兼容问题，以下是根因和修复：

### 1. ES module → CommonJS 转换
**根因**：`pkg` 无法打包 `"type": "module"` 的 ES module 项目，导致 server.js 根本没有被打进 exe。  
**修复**：全项目改为 CommonJS（`require`/`module.exports`），移除 `package.json` 中的 `"type": "module"`。

### 2. cheerio 降级
**根因**：`cheerio@1.2.0` 依赖 `undici@7`，后者要求 Node.js >= 20.18.1，而 pkg 内置 Node 18.5.0。  
**错误**：`ReferenceError: File is not defined`  
**修复**：`cheerio` 降级到 `1.0.0-rc.12`（不依赖 undici）。

### 3. 移除 pdfkit（去掉 PDF 导出）
**根因**：`pdfkit` 依赖 `fontkit`，`fontkit` 使用 `TextDecoder("ascii")`，在 pkg 的 small-icu Node 18.5.0 中不支持。  
**错误**：`RangeError [ERR_ENCODING_NOT_SUPPORTED]: The "ascii" encoding is not supported`  
**修复**：移除 `pdfkit`，去掉 PDF 导出功能。Word (.docx) 导出保留正常。PDF 可在 Word 中另存为实现。

### 4. 时区 fallback
**根因**：`todayISO()` 使用 `Australia/Sydney` 时区，在 pkg small-icu 中不可用，导致日期格式非法。  
**错误**：`RangeError: Invalid time value`  
**修复**：`todayISO()` 加入 try/catch，失败时 fallback 到本地系统时间。

### 5. 自动打开浏览器 & 防多开
**新增功能**：
- exe 启动后自动打开默认浏览器访问 `localhost:3333`
- 再次双击 exe 时，检测端口已占用，直接打开浏览器，不重复启动服务
- 启动失败时窗口显示错误信息并等待 Enter 退出，不再无声闪退

### 6. Word 导出修复
- 从输出 HTML 文件（`.word`）改为真正的 `.docx` 格式（使用 `docx` 库）
- PDF 按钮已从导出界面移除

## 使用方式
直接双击 `dist/local-notice-radar.exe`，无需安装任何软件。

# QR-Studio / 码语 · 文本二维码工作室

A privacy-first static web app that turns text into QR codes, decodes QR images, and imports text files for conversion. It has no backend and does not upload user content.

一个注重隐私的静态网页工具：将文本转换为二维码、解析二维码图片，并导入文本文件后生成二维码。它不包含后端，也不会上传用户内容。

## Features / 功能

- Generate QR codes from plain text, URLs, contact cards, and Wi-Fi payloads.
- Import UTF-8 `.txt`, `.md`, `.csv`, or `.json` files into the generator.
- Decode a QR code from a locally selected or dropped image.
- Use typed forms for URLs, Wi-Fi, vCards, email, telephone and SMS, alongside plain text.
- Export PNG or SVG, generate up to 50 codes in a ZIP, and preview A4 labels for printing or browser Save as PDF.
- Enlarge single and batch codes using vector previews; use separate workspaces on desktop and mobile.
- Clear all page data manually, after 1/5/15/30 idle minutes (5 by default), or optionally when the page is hidden.
- All typed text, imported files, and uploaded images stay in the browser.

- 支持从纯文本、网址、联系人名片和 Wi-Fi 信息生成二维码。
- 支持导入 UTF-8 编码的 `.txt`、`.md`、`.csv` 或 `.json` 文件。
- 支持选择或拖入图片，在本地解析其中的二维码。
- 提供文本、网址、Wi-Fi、名片、邮件、电话、短信共 7 种内容类型；表单自动生成标准编码格式。
- 支持四档容错、256～2048 px、颜色与 4 / 6 / 8 格留白，并下载 PNG 或 SVG。
- 批量生成最多 50 个二维码，支持逐行文本、Tab 分隔名称、带引号及换行的两列 CSV；可导入不超过 256 KB 的 TXT / CSV。
- 批量下载 SVG 或 PNG 的 ZIP；失败项单独提示，导出仅包含成功项。
- A4 标签每页 3 列 × 4 行，单码可重复 1 / 6 / 12 次；通过浏览器打印窗口打印或另存为 PDF。
- 显示二维码版本、网格大小、字节数、颜色对比度，并提供当前图片的识别自检。
- 点击单个或批量二维码可放大预览，支持适应屏幕、1.5 倍、2 倍及滚动查看；使用矢量图保持清晰。可点关闭、按 Esc 或点击窗口外部退出，预览也纳入一键和定时清理。
- 所有输入文本、导入文件和上传图片都只在浏览器内处理。
- 默认 5 分钟无操作后清理，可选择 1 / 5 / 15 / 30 分钟或关闭；操作会重新计时。
- 一键清除当前标签页的文本、二维码画布、图片预览、解析结果和文件选择。
- 可选切到后台立即清理；刷新、离开页面和从前进/后退缓存恢复时清理。

## Privacy controls / 隐私控制

内容和隐私设置仅存在于当前页面，不写入 Cookie、localStorage、sessionStorage 或 IndexedDB，也不发送给服务器。页面加载本地脚本和样式后，生成、导入和解析均无需网络。CSP 禁止连接请求、外部资源和表单提交；本地服务仅接受 GET/HEAD，仅提供明确允许的页面资源，并设置 no-store、防嵌入和无 Referer 响应头。静态托管保留 HTML 中的 CSP 和 Referrer 策略，其余响应头需由托管方配置。托管方仍可能记录页面访问元数据，例如 IP 地址和访问时间；这与上传用户内容不同。

清理会重置画布、撤销图片对象 URL、取消图片加载并使过期的文本读取结果失效，避免清理后又回填内容。浏览器后台休眠可能暂停定时器，页面恢复或下次操作前会按实际时间检查到期。切到后台立即清理也可能在切换应用或打开系统文件选择器时触发，请按需开启。

新增表单（包括 Wi-Fi 密码）、批量输入与结果、下载对象 URL 和打印预览也纳入清理。批量生成与导出在清理后取消，不会继续回填旧结果。

清理不删除原始文件、已下载图片、其他标签页或系统剪贴板，也不承诺对浏览器/系统内存进行不可恢复的擦除。二维码不是加密格式；任何获得图片的人都可能读取其中内容。浏览器扩展、截图、系统备份及剪贴板历史不在页面控制范围内。

## Batch and print / 批量与打印

顶部导航可切换“单个制作”“批量生成”“图片解码”，切换时保留当前页面的输入；隐私设置位于工作区之后，也可从顶部入口直达。“外观与导出设置”默认折叠，单个和批量共用样式参数。手机上可通过“查看二维码”和“返回编辑内容”在输入与预览之间跳转。Wi-Fi、名片等表单的编码原文可按需展开查看。

桌面端编辑区与预览区使用分开的圆角卡片，保持等高、底边对齐；小屏幕自动上下排列。界面使用紫色主题、浅紫背景和柔和阴影。

选择“每行一个内容”时，每行生成一个二维码，可用 Tab 分隔名称和内容。CSV 模式使用两列，可选首行 `name,content`：

```csv
name,content
设备 001,ASSET-001
产品页面,https://example.com/product
多行文本,"第一行
第二行"
```

批量结果保留生成时的外观快照；修改颜色、尺寸或容错后请重新生成。ZIP 文件名前加序号，避免重名覆盖。打印统一黑白，每页最多 12 个标签；建议 A4、100% 比例、关闭浏览器页眉页脚。PDF 由浏览器打印功能提供。部分嵌入式浏览器不支持下载或打印时，请在系统浏览器打开本地地址。

本项目生成静态二维码，图片本身不会到期；网址是否可用由目标网站决定。未提供云端活码、访问统计或媒体托管，以保持当前“不上传内容”的设计。识别自检和对比度提示只能辅助发现问题，不能保证所有设备或打印材料都能识别，交付前应实机扫描。

功能与代码参考、许可证选择依据见 [开源与同类产品调研](docs/competitive-research-2026-10-24.md)。

## Run locally / 本地运行

Requirements: a modern browser. Node.js 18+ is required for the one-click server and verification.

运行要求：现代浏览器。一键启动服务和执行验证时需要 Node.js 18+。

```powershell
cd QR-Studio
npm start
```

Then open `http://127.0.0.1:8085/`.

随后打开 `http://127.0.0.1:8085/`。

### One-click start on Windows / Windows 一键启动

Double-click [start.bat](start.bat). It starts the local server and opens the app in your default browser. Keep its terminal window open while using the app; press `Ctrl+C` to stop it.

双击 [start.bat](start.bat) 即可启动本地服务，并在默认浏览器中打开应用。使用期间请保持命令行窗口打开；按 `Ctrl+C` 可停止服务。

You can also run `npm start`, or `npm run start:open` to start and open the page from a terminal.

也可以在命令行中执行 `npm start`，或执行 `npm run start:open` 来启动并自动打开页面。

## Server deployment / 服务器部署

The app is served by Nginx at [https://170.9.3.185/qr-studio/](https://170.9.3.185/qr-studio/). GitHub hosts the source and runs verification; GitHub Pages deployment has been removed. Run `npm run verify` and `npm run build`, then deploy only `dist/`. No Node.js runtime or content backend is needed on the server.

线上地址：[https://170.9.3.185/qr-studio/](https://170.9.3.185/qr-studio/)。项目由 Nginx 静态托管，GitHub 保留源码和自动测试，已移除 Pages 部署。执行 `npm run verify` 和 `npm run build` 后仅发布 `dist/`，服务器无需 Node.js 运行时或处理用户内容的后端。

部署布局、Nginx 配置和回滚方式见 [服务器部署说明](docs/server-deployment.md)。服务器的站点访问日志关闭；输入内容始终只在浏览器处理，系统与网络层仍可能记录连接元数据。

## Verify / 验证

```powershell
npm run verify
```

This checks JavaScript syntax, required local assets, page-to-script wiring, privacy lifecycle behavior, and QR encode/decode round trips. It does not replace manual testing of QR scanning with real devices.

该命令检查 JavaScript 语法、本地资源、页面与脚本的关联、隐私清理生命周期、表单格式与输入验证、CSV 解析、ZIP 的 CRC 与独立解压验证、实际绘制像素的二维码编码/解析往返结果，以及真实本地 HTTP 服务的资源白名单与安全响应头。它不能替代使用真实设备进行二维码扫描的手动测试。

本次浏览器操作、响应式检查及验证边界见 [发布验证记录](docs/release-validation-2026-10-24.md)。

## Privacy and third-party code / 隐私与第三方代码

The app does not include telemetry, storage, credentials, or network APIs for user content. Bundled QR libraries are loaded from `vendor/` rather than a CDN. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for their upstream sources and licenses.

应用不包含遥测、存储用户内容、凭据或面向用户内容的网络 API。随附的二维码库从 `vendor/` 本地加载，而不是通过 CDN。其上游来源和许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## Release checklist / 发布检查清单

1. Choose and add a project `LICENSE`; no license has been selected yet. See [LICENSE-NOTICE.md](LICENSE-NOTICE.md).
2. Run `npm run verify` and `npm run build`.
3. Review `git status --short`, including ignored files, and confirm no personal images, text files, credentials, or runtime artifacts are included.
4. Review the staged file list and run `git diff --cached --check` before committing.
5. Choose the GitHub repository name, visibility, and remote deliberately before any push.

1. 选择并添加项目 `LICENSE`；当前尚未选择许可证。详见 [LICENSE-NOTICE.md](LICENSE-NOTICE.md)。
2. 执行 `npm run verify` 和 `npm run build`。
3. 检查 `git status --short`（包括忽略文件），确认未包含个人图片、文本文件、凭据或运行时产物。
4. 提交前检查暂存文件列表，并执行 `git diff --cached --check`。
5. 在推送前审慎选择 GitHub 仓库名、可见性和远程地址。

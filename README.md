# QR-Studio / 码语 · 文本二维码工作室

A privacy-first static web app that turns text into QR codes, decodes QR images, and imports text files for conversion. It has no backend and does not upload user content.

一个注重隐私的静态网页工具：将文本转换为二维码、解析二维码图片，并导入文本文件后生成二维码。它不包含后端，也不会上传用户内容。

## Features / 功能

- Generate QR codes from plain text, URLs, contact cards, and Wi-Fi payloads.
- Import UTF-8 `.txt`, `.md`, `.csv`, or `.json` files into the generator.
- Decode a QR code from a locally selected or dropped image.
- Adjust error correction, export size, and foreground/background colours; download PNG output.
- All typed text, imported files, and uploaded images stay in the browser.

- 支持从纯文本、网址、联系人名片和 Wi-Fi 信息生成二维码。
- 支持导入 UTF-8 编码的 `.txt`、`.md`、`.csv` 或 `.json` 文件。
- 支持选择或拖入图片，在本地解析其中的二维码。
- 支持设置容错等级、导出尺寸和前景/背景颜色，并下载 PNG。
- 所有输入文本、导入文件和上传图片都只在浏览器内处理。

## Run locally / 本地运行

Requirements: a modern browser. Node.js 18+ is required only for verification.

运行要求：现代浏览器。仅执行验证时需要 Node.js 18+。

```powershell
cd QR-Studio
python -m http.server 8085
```

Then open `http://127.0.0.1:8085/`.

随后打开 `http://127.0.0.1:8085/`。

### One-click start on Windows / Windows 一键启动

Double-click [start.bat](start.bat). It starts the local server and opens the app in your default browser. Keep its terminal window open while using the app; press `Ctrl+C` to stop it.

双击 [start.bat](start.bat) 即可启动本地服务，并在默认浏览器中打开应用。使用期间请保持命令行窗口打开；按 `Ctrl+C` 可停止服务。

You can also run `npm start`, or `npm run start:open` to start and open the page from a terminal.

也可以在命令行中执行 `npm start`，或执行 `npm run start:open` 来启动并自动打开页面。

## Deploy with GitHub Pages / 使用 GitHub Pages 部署

The included [GitHub Pages workflow](.github/workflows/deploy-pages.yml) builds and deploys the static app after a push to `main` (or by manually running the workflow). Before the first deployment, create a GitHub repository, push this project, then set **Settings → Pages → Source** to **GitHub Actions**. The workflow will report the public URL after it succeeds.

随附的 [GitHub Pages 工作流](.github/workflows/deploy-pages.yml) 会在推送到 `main` 后（或通过手动运行工作流）构建并部署静态应用。首次部署前，请创建 GitHub 仓库并推送本项目，然后在 **Settings → Pages → Source** 中选择 **GitHub Actions**。工作流成功后会显示公开访问地址。

## Verify / 验证

```powershell
npm run verify
```

This checks JavaScript syntax, required local assets, and the page-to-script wiring. It does not replace manual testing of QR scanning with real devices.

该命令检查 JavaScript 语法、必需的本地资源，以及页面与脚本的关联。它不能替代使用真实设备进行二维码扫描的手动测试。

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

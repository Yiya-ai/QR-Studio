# Contributing / 参与贡献

Thank you for helping improve QR-Studio. Please keep contributions small, privacy-preserving, and easy to verify.

感谢你帮助改进码语。请保持提交范围清晰、保护隐私，并确保易于验证。

## Before opening a pull request / 提交拉取请求前

1. Do not add QR images, imported text, browser exports, `.env` files, API keys, or other personal data.
2. Keep QR generation, decoding, and text-file import local to the browser unless the change is explicitly documented and reviewed.
3. Run `npm run verify` and describe manual interaction checks in the pull request.
4. Update the Chinese and English documentation together when user-visible behavior or privacy boundaries change.

1. 请勿提交二维码图片、导入文本、浏览器导出文件、`.env` 文件、API 密钥或其他个人数据。
2. 除非变更经过明确记录与审查，否则二维码生成、解析和文本文件导入应始终在浏览器本地完成。
3. 请执行 `npm run verify`，并在拉取请求中说明已进行的手动交互检查。
4. 当用户可见行为或隐私边界发生变化时，请同步更新中英文文档。

## Reporting issues / 反馈问题

Use a minimal, non-sensitive reproduction. Do not include production QR payloads, full contact cards, Wi-Fi passwords, or confidential URLs.

请提供最小且不含敏感信息的复现步骤。不要附上真实二维码内容、完整联系人名片、Wi-Fi 密码或机密网址。

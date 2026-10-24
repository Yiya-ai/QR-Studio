# Third-party notices / 第三方声明

This project bundles the following browser libraries in `vendor/` so QR processing does not depend on a CDN at runtime.

本项目在 `vendor/` 目录内附带以下浏览器库，以便二维码处理在运行时不依赖 CDN。

| Library | Version | Purpose | License | Source |
| --- | --- | --- | --- | --- |
| Nayuki QR Code generator | 1.8.0 | Active QR code generation | MIT | https://github.com/nayuki/QR-Code-generator |
| qrcodejs | 1.0.0 | Legacy asset, no longer loaded by the page | MIT | https://github.com/davidshimjs/qrcodejs |
| jsQR | 1.4.0 | QR code decoding | Apache-2.0 | https://github.com/cozmo/jsQR |

`vendor/qrcodegen.js` is the unmodified official v1.8.0 ES6 release asset, downloaded from https://github.com/nayuki/QR-Code-generator/releases/download/v1.8.0/qrcodegen-v1.8.0-es6.js. Its complete MIT copyright and license header is retained in the file. SHA-256: `6A1116192ED1DD67FA1BF31E77F5817103D71C23BBAC24C382E698B7668BDD01`.

The page now uses Nayuki's matrix API; application SVG/canvas rendering, payload forms and ZIP packaging are implemented locally. `soldair/node-qrcode` was inspected for design comparison only; its code is not bundled. Commercial websites were used as feature references, not copied.

Earlier local modification (2026-10-24): the retained, inactive qrcodejs asset uses TextEncoder for byte encoding and capacity calculation. Current round-trip tests cover the active Nayuki encoder and renderer.

The full jsQR Apache-2.0 license is retained in `vendor/jsqr.LICENSE.txt` (from the upstream repository's LICENSE). The retained legacy qrcodejs MIT license is in `vendor/qrcodejs.LICENSE.txt`. The Pages bundle includes only the active libraries and their notices; the legacy library remains in the source repository.

Review the upstream license terms before distributing modified third-party files.

如需分发修改过的第三方文件，请先审阅上游许可证条款。

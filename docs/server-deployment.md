# Server deployment / 服务器部署

Public URL / 访问地址：<https://170.9.3.185/qr-studio/>

The app shares the server's existing HTTPS listener and IP certificate. It is mounted under `/qr-studio/` to preserve the existing site. Only static build assets are deployed; SSH keys, source control metadata, tests and user files must never be uploaded into the public directory.

本站复用现有 HTTPS 监听与 IP 证书，通过 `/qr-studio/` 子目录保留原网站。仅发布构建资源，不上传 SSH 密钥、Git 元数据、测试文件或用户数据。证书续期沿用服务器现有任务。

## Layout / 目录

- Releases: `/opt/qr-studio/releases/<release-id>/`
- Active release symlink: `/opt/qr-studio/current`
- Nginx snippet: `/etc/nginx/snippets/qr-studio.conf`, sourced from [deploy/nginx-qr-studio.conf](../deploy/nginx-qr-studio.conf).
- Include the snippet once inside the existing HTTPS `server` block: `include /etc/nginx/snippets/qr-studio.conf;`.

## Update / 更新

1. Run `npm run verify` and `npm run build` locally.
2. Upload only the contents of `dist/` into a new release directory. Use root-owned directories with mode 755 and files with mode 644.
3. Atomically switch `current` to the verified release using a temporary symlink and `mv -Tf`. Keep the previous release for rollback.
4. After any configuration change, run `sudo nginx -t` before `sudo systemctl reload nginx`.
5. Verify HTTPS, static assets, QR generation/self-check, downloads, decoding and cleanup. Check missing/private paths return 404 and POST returns 405.

先验证并构建，再上传到新版本目录，原子切换 `current` 软链接；保留旧版本。配置改动必须先通过 `nginx -t` 再重载。更新源码不会自动更新服务器，GitHub 目前只执行测试。

## Rollback / 回滚

Switch `current` back to the preceding release symlink target. Restore the saved Nginx configuration if the change involved routing, validate it, then reload. Never overwrite another site's files or remove shared HTTPS/certificate services.

回滚时把 `current` 切回上一版本。如涉及路由配置，恢复部署前备份，通过语法检查后重载。不要覆盖其他网站或移除共用 HTTPS、证书续期服务。

## Privacy / 隐私

Nginx only allows GET/HEAD for an explicit asset list and disables site access logging. Responses include no-store, CSP, anti-framing and no-referrer headers. There is no upload endpoint or database. Existing server error/security logs and hosting-network metadata remain outside browser data clearing.

Nginx 对明确列出的静态资源只允许 GET/HEAD，关闭本站访问日志，并发送禁止缓存、CSP、防嵌入和无 Referer 响应头。没有上传接口或数据库。页面清理不影响现有服务器错误、安全日志及云网络连接元数据。

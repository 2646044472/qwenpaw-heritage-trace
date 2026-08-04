# AWS Backend Handoff

腾讯云只托管本项目的静态前端。生产流量必须遵循以下路径：

```text
Browser -> https://frontend-domain/api/... -> Tencent Nginx -> https://aws-api-domain/...
```

前端保持同源 `/api`，不把 AWS API URL、LLM Key 或任何模型配置写进浏览器。Nginx 模板见 `../deploy/nginx-frontend-aws.conf.example`，运行时配置为 `../frontend/runtime-config.js`。

## Stable result contract

`GET /api/projects/{project_id}/frontend-result` 在登录后返回：

```json
{
  "run_id": "workflow-run-id",
  "workflow_status": "needs_review",
  "frontend_result": {}
}
```

其中 `frontend_result` 必须完整符合 `frontend-result.v1.schema.json`。可用 `frontend-result.v1.mock.json` 做首次联调。未知字段可添加，但不得重命名、删除或改变现有字段的类型和枚举含义；破坏性变更必须发布新 schema version。

后端负责确定性地计算 `summary`、`review_queue` 与 `publication.safe_to_publish`。前端仅显示这些结果，不自行推导来源冲突、统计数字或发布资格。Claim 的 `verification_status` 只允许 `supported`、`partially_supported`、`unsupported`、`unverifiable`；冲突、时间上下文缺失、引用错误等必须进入 `risk_flags`。

## API compatibility

管理端还需要 README 中列出的 `/api/session`、`/api/login`、`/api/logout`、projects、sources、claims、publications、AI drafts 和 workflow routes。写操作使用 JSON，并要求 `X-CSRF-Token`；登录态通过 `HttpOnly; Secure; SameSite=Lax` Cookie 维持。`/api/ai/status` 只能返回模型是否配置和显示名，绝不能返回 Key。

登录、角色、CSRF、审计和发布拦截全部在 AWS 后端执行。即使腾讯云静态站点公开可访问，未登录请求也必须不能读取或写入管理数据。

## Qwen-Paw integration

Qwen-Paw 只作为 AWS 后端中的 Archivist / Verifier 能力调用：管理端请求 AWS 的 `/api/projects/{id}/ai-drafts` 或 `/workflow`，由 AWS 服务端按已授权来源组装任务、调用已获准的 Qwen-Paw / 模型适配器，再验证并保存最终 contract。浏览器、腾讯云静态文件和 `frontend/runtime-config.js` 都不得保存或转发模型凭据。模型输出仅是待核验候选；确定性 Coordinator 校验失败时必须重试一次，随后以 `completed_with_errors` 结束，不能伪装为完成。

## Reverse-proxy trust boundary

AWS 入口只接受来自腾讯云 Nginx 的代理流量，或以安全组、WAF、mTLS / 共享网关凭据达到同等保护。后端仅在该边界可信时才解释 `X-Forwarded-For`、`X-Forwarded-Host` 与 `X-Forwarded-Proto`；不能让互联网客户端直接伪造这些头。

AWS API 必须使用有效 HTTPS 证书与稳定域名。Nginx 会保留请求路径，因此 AWS 应接受 `/api/...` 前缀。若后端移除此路径前缀，必须同时明确调整 `proxy_pass`，并在联调时验证所有 API route、Cookie `Path=/` 与 CSRF Origin 校验。

# Local Backend Contract

## Public Heritage Workflow v2

`heritage-workflow.openapi.yaml` is the canonical OpenAPI 3.1 contract for
`/api/v2/heritage/workflows`. The public boundary exposes only its request,
status, success, and failure schemas. Agent outputs, claims, normalized source
bundles, prompts, messages, and transport data remain backend-internal.

The frontend-result v1 files below belong to the separate authenticated
project administration flow and do not redefine the public Workflow v2 API.

## Competition demo invariant

The public v2 request, status, and result schemas carry the same fixed
`shop_id`: `lei-kei-001`. This is the single 禮記雪糕 competition demo shop.
When omitted by an older client, the API supplies that id before validating the
request; any other id is rejected. The fixture result is stored at
`../../fixtures/lei-kei-001.workflow-result.json`. It is intentionally demo
data, not a claim of verified historical fact.

GitHub 只负责同步仓库；前端和后端在同一台电脑上运行：

```text
Browser -> same-origin /api/... -> local Python API -> local database and optional LLM
```

前端保持同源 `/api`，不把 API URL、LLM Key 或任何模型配置写进浏览器。运行时配置为 `../frontend/runtime-config.js`；本机 Nginx 可选模板见 `../deploy/nginx-all-in-one.conf.example`。

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

登录、角色、CSRF、审计和发布拦截全部在本机后端执行。即使前端文件可被打开，未登录请求也必须不能读取或写入管理数据。

## Qwen-Paw integration

Qwen-Paw 只作为本機後端中的 Archivist / Verifier 能力调用：管理端请求本机的 `/api/projects/{id}/ai-drafts` 或 `/workflow`，由后端按已授权来源组装任务、调用已获准的 Qwen-Paw / 模型适配器，再验证并保存最终 contract。浏览器和 `frontend/runtime-config.js` 都不得保存或转发模型凭据。模型输出仅是待核验候选；确定性 Coordinator 校验失败时必须重试一次，随后以 `completed_with_errors` 结束，不能伪装为完成。

## Local trust boundary

API 默认只监听 `127.0.0.1`。如使用本机 Nginx，Nginx 会保留 `/api/...` 路径并代理到该回环端口；只有本机反向代理可以设置 `X-Forwarded-*` 头。不要将 API、数据库或模型端口直接暴露到局域网或互联网。

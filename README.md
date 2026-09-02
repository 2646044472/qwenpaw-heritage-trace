# Heritage Trace — competition demo

Heritage Trace is a two-mode demonstration of a heritage-shop discovery and
verification workflow.  It is deliberately designed to work at a competition
booth with no provider account or model key: the default **fixture mode** runs
the complete browser → API → workflow lifecycle with deterministic data.

The demo shop used everywhere is **禮記雪糕** (`lei-kei-001`).  Shop signals,
exposure/sentiment figures, map pins, routes, and merchant recommendations are
demo data.  They are not claims about real businesses.  Only live mode asks
QwenPaw agents to perform a real workflow.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web/` | Next.js presentation for Government, Merchant / Pawly, and Hunter |
| `services/api/` | Python Workflow v2 API and fixture/live executors |
| `packages/contracts/` | Versioned OpenAPI workflow contract |
| `fixtures/` | Portable, deterministic demo inputs and results |
| `deployment/qwenpaw/` | Safe QwenPaw workspace templates and local provider-env example |
| `docs/` | Architecture and the booth presentation script |

## Start the no-key demo

Prerequisites: Docker Desktop (with Compose v2) is running.

For a completely new computer, including Docker Desktop installation and the
first-run WSL prompt on Windows, follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
before running the command below.

```powershell
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).  The API is available at
[http://localhost:8000](http://localhost:8000) and exposes a health endpoint at
`/api/health`.

The included Compose configuration protects the website with HTTP Basic Auth.
Its presentation defaults are `OCTRA` / `OCTRAum`; set `WEB_AUTH_USER` and
`WEB_AUTH_PASSWORD` in an ignored `.env` file before any non-demo deployment.
The authentication gate covers both pages and the web application's API proxy,
so an unauthenticated visitor cannot trigger a workflow directly.

From Government, select 禮記雪糕 and choose **Run workflow**.  The web app sends
`POST /api/v2/heritage/workflows`, polls the returned run id, and obtains the
result through `GET /api/v2/heritage/workflows/{runId}/result`.  Merchant / Pawly
and Hunter reuse the same `lei-kei-001` result in the browser.

Stop the demo with:

```powershell
docker compose down
```

The named `heritage_trace_data` volume can be removed for a completely fresh
run with `docker compose down -v`.  This is optional and removes local demo
runtime state only.

## Start live QwenPaw mode

1. Open QwenPaw Console after starting the live stack and configure the local
   provider endpoint, model, and key for that computer. QwenPaw saves this
   configuration in its local named secret volume. Alternatively use the
   ignored `.env` file when the chosen QwenPaw release supports provider
   environment variables. Do not use a Coding Plan key.
3. Start the live stack:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.live.yml up --build
   ```

This adds QwenPaw and switches the API to the real executor.  Its console is
intentionally local-only at [http://127.0.0.1:8088](http://127.0.0.1:8088).
The API checks that these four template agents are present before dispatch:

- `Heritage-Coordinator`
- `Paw-Miner`
- `Paw-Archivist`
- `Paw-Verifier`

QwenPaw working files, secrets, and backups use local Docker named volumes.
They persist across ordinary `docker compose down` commands; do not use
`down -v` if you want to keep the local model configuration. The repository
keeps only templates and an environment-variable example; `.env`, databases,
volume state, provider keys, sessions, and credentials are ignored.

## Environment variables

The default Compose values are sufficient for fixture mode.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `QWENPAW_WORKFLOW_EXECUTOR` | API | `fixture` by default; live overlay sets `real` |
| `QWENPAW_BASE_URL` | API | QwenPaw service URL, normally `http://qwenpaw:8088` |
| `QWENPAW_CRAWL_URLS` | API | Optional comma-separated public HTTP(S) pages for live source collection |
| provider variables in local `.env` | QwenPaw | Local model endpoint, model identifier, and provider key |

真实网页采集是 live mode 的可选功能，不是默认行为。设置
`QWENPAW_CRAWL_URLS` 后，API 会限制大小地下载这些公开 HTML 页面，提取可见文字和
URL provenance，再交给 Paw-Miner；不会登录社交平台、发帖或抓取无限页面。留空时
仍使用固定的 competition source，开发模式也始终不需要模型 Key。

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for mode boundaries and
[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the presentation flow.

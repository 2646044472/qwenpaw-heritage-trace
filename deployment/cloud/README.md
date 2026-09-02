# Cloud deployment

This is the production-shaped deployment path for a Linux host with Docker
Compose v2 and nginx. The application containers bind to loopback; nginx is
the only public entry point.

## 1. Install the host prerequisites

Install Docker Engine with the Compose v2 plugin and nginx using the host
distribution's official packages. Add the deployment user to the `docker`
group, then start Docker and nginx. These operations require an administrator
account and are intentionally not performed by the application container.

## 2. Copy the release and private configuration

Copy the repository (or the release zip) to `/srv/heritage-trace`, then create
`/srv/heritage-trace/.env` with mode `0600`. Start from `.env.example` and set
the live provider values:

```dotenv
QWENPAW_LLM_BASE_URL=https://your-relay.example/v1
QWENPAW_LLM_API_KEY=operator-issued-key
QWENPAW_LLM_MODEL=your-model-id
QWENPAW_LLM_TIMEOUT_SECONDS=30
QWENPAW_WORKFLOW_EXECUTOR=real
WEB_AUTH_USER=OCTRA
WEB_AUTH_PASSWORD=OCTRAum
```

`QWENPAW_LLM_*` is consumed by the API's direct, OpenAI-compatible relay
requests (Pawly and the grounded drafting endpoint). QwenPaw's own provider
secret is kept in its named secret volume; set the provider-specific variable
documented by the selected QwenPaw image, or configure it once in the local
QwenPaw Console. Never commit this file or put the key in a frontend variable.

## 3. Start and verify

```bash
docker compose -f docker-compose.yml -f docker-compose.live.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.live.yml ps
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/api/pawly/status
```

The public nginx site should proxy to `127.0.0.1:3000`. The browser then
prompts for the Basic Auth credentials before loading the Government,
Merchant, or Hunter surfaces. Run one Government workflow and refresh the
page: the persisted run id must remain visible and the start button must not
reappear.

## 4. Stop or update

```bash
docker compose -f docker-compose.yml -f docker-compose.live.yml down
docker compose -f docker-compose.yml -f docker-compose.live.yml up -d --build
```

Do not use `down -v` on a live installation: named volumes contain workflow
state, QwenPaw working files, provider secrets, and backups.

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

The public nginx site should proxy to `127.0.0.1:3000`. Run one Government
workflow and refresh the page: the persisted run id must remain visible and
the start button must not reappear.

The API, Web, and QwenPaw services use `restart: unless-stopped`; after a host
reboot Docker brings them back automatically, and the API reconnects any
non-terminal workflow runs from the database.

### HTTPS on an IP-only host

The current host has no domain, so a publicly trusted certificate cannot be
issued for it. For temporary encrypted testing, generate a self-signed
certificate with a Subject Alternative Name for the server IP, add an nginx
`listen 443 ssl` server, and allow TCP 443 in both UFW and the cloud provider's
security group. Browsers will show a one-time trust warning for this
certificate. For production, point a domain at the server and replace the
self-signed files with a trusted CA certificate (for example, Certbot/Let's
Encrypt), then redirect port 80 to HTTPS. Keep the API and QwenPaw ports bound
to loopback.

## 4. Stop or update

```bash
docker compose -f docker-compose.yml -f docker-compose.live.yml down
docker compose -f docker-compose.yml -f docker-compose.live.yml up -d --build
```

Do not use `down -v` on a live installation: named volumes contain workflow
state, QwenPaw working files, provider secrets, and backups.

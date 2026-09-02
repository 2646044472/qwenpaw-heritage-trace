# New-computer deployment guide

This guide deliberately starts from a computer that has only Git and this
repository.  The default fixture demo needs **no model account, API key, social
account, or external data connection**.

## 1. Install Docker Desktop

### Windows 10/11

1. Enable CPU virtualization in BIOS/UEFI if it is disabled.
2. Open PowerShell and install Docker Desktop:

   ```powershell
   winget install --id Docker.DockerDesktop --exact --source winget --accept-package-agreements --accept-source-agreements
   ```

   If `winget` is not available, download Docker Desktop from
   [Docker's official Windows install page](https://docs.docker.com/desktop/setup/install/windows-install/).
3. Start **Docker Desktop** from the Start menu.  On its first run, accept the
   WSL 2 backend option and follow its prompt to install/update WSL.  Restart
   Windows if it asks you to.
4. Wait until Docker Desktop reports that its engine is running, then verify:

   ```powershell
   docker version
   docker compose version
   ```

The installer may request administrator permission.  That is expected: Docker
needs the local virtualization/WSL components.  Do not continue until both
commands return versions.

#### If Docker Desktop says WSL is missing

Windows Home uses the WSL 2 backend.  Open **PowerShell as Administrator** and
run:

```powershell
wsl --install --no-distribution
```

Restart Windows when prompted, open Docker Desktop again, and wait for it to
say the engine is running.  `--no-distribution` installs only the Docker
prerequisite; it does not download an Ubuntu desktop or add a Linux user.  If
Windows reports that virtualization is disabled, enable CPU virtualization in
BIOS/UEFI before retrying.

### macOS or Linux

Install Docker Desktop (macOS) or Docker Engine plus the Compose plugin (Linux)
using [Docker's official instructions](https://docs.docker.com/get-started/get-docker/).
Confirm `docker version` and `docker compose version` before continuing.

## 2. Get the project

```powershell
git clone <your-repository-url> heritage-trace
Set-Location heritage-trace
git switch codex/competition-demo-integration
```

If the branch has already been merged, use the project default branch instead.

## 3. Run the fixture demo (recommended first run)

```powershell
docker compose up --build
```

The initial build downloads the Python and Node images and can take several
minutes.  Keep this terminal open.  When it is ready, open
`http://localhost:3000` and select **Government** → 禮記雪糕 → **Run workflow**.

The default website credentials are `OCTRA` / `OCTRAum`. For a public or
long-running deployment, copy `.env.example` to the ignored `.env` and replace
both `WEB_AUTH_USER` and `WEB_AUTH_PASSWORD` before starting Compose. Keep the
credentials in that local file, not in a command history or a Git commit.

In another PowerShell window, these checks are useful:

```powershell
curl http://localhost:8000/api/health
docker compose ps
```

To stop the stack, press `Ctrl+C` in its terminal, then run:

```powershell
docker compose down
```

Fixture mode is complete without a `.env` file.  It uses the fixed
`lei-kei-001` result and keeps the workflow HTTP lifecycle real.

## 4. Optional: run the live Agent stack

Only do this after the fixture demo works.

1. Start the extended stack:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.live.yml up --build
   ```

2. Open the app at `http://localhost:3000`.  QwenPaw Console is local-only at
   `http://127.0.0.1:8088`.  It must show these agents before a real run can
   dispatch: Heritage-Coordinator, Paw-Miner, Paw-Archivist, Paw-Verifier.
3. In that local Console, configure the provider URL, model ID, and key for
   this presentation computer. QwenPaw persists the configuration only in its
   local named secret volume. An ignored root `.env` is an alternative for
   provider variables supported by the selected QwenPaw release; never commit
   it or use a personal Coding Plan key.

The live stack stores working data, QwenPaw secrets, and backups in named
Docker volumes. It does not put provider keys in the Git worktree. The volumes
survive ordinary `down`, so the local Console model configuration remains for
the next run. To stop it use the matching command with `down`:

```powershell
docker compose -f docker-compose.yml -f docker-compose.live.yml down
```

For a repeatable competition run, the live overlay supplies Miner with
`fixtures/lei-kei-001.live-demo-source.json`: a clearly labelled fictional
source pack. This lets all three specialist Agents execute while preserving the
Demo-data boundary. Replace `QWENPAW_DEMO_SOURCE_PATH` in local `.env` when
testing an operator-supplied source pack; never present the bundled fixture as
independently verified history.

### Optional: collect one or two public pages

For a small live-data experiment, put `QWENPAW_CRAWL_URLS` in the ignored root
`.env` as a comma-separated list of public `http://` or `https://` URLs. The API
downloads each page once (bounded to `QWENPAW_CRAWL_MAX_BYTES`), extracts visible
HTML text, records the URL as evidence, and sends that source bundle to
Paw-Miner. Set `QWENPAW_DEMO_SOURCE_PATH=` so the crawl is used instead of the
fictional source. This is deliberately a bounded collector: it does not log in,
follow links, bypass robots/rate limits, call social-platform APIs, or publish
anything. Empty or failed crawls produce a visible Workflow error rather than
silently reverting to fictional facts.

## 5. Manually inspect a real Agent response

The QwenPaw console returns `text/event-stream`, not one final JSON document.
The API client joins the `object: content` text chunks, extracts the Agent's
JSON, and then validates it against the Workflow v2 contract. A simple local
smoke test (after configuring a provider in the Console) is:

```powershell
$chatBody = @{
  session_id = "manual-check-$(Get-Date -Format yyyyMMddHHmmss)"
  user_id = "manual-check"
  channel = "console"
  input = @(@{
    role = "user"
    content = @(@{ type = "text"; text = '只回复一个 JSON：{"ok":true,"message":"模型已连接"}' })
  })
} | ConvertTo-Json -Depth 8

$reply = Invoke-WebRequest -Method Post `
  -Uri http://127.0.0.1:8088/api/console/chat `
  -Headers @{ Accept = "text/event-stream"; "X-Agent-Id" = "Heritage-Coordinator" } `
  -ContentType "application/json" -Body $chatBody
$reply.Content
```

The output contains `data: {...}` SSE events. Look for a completed response and
the assistant text. To test the complete application path, use the Government
button; it performs `POST` create → repeated `GET` status → `GET` result. In
live mode the API calls Miner, Archivist, and Verifier in sequence. In fixture
mode no model provider is called.

## Troubleshooting

| Symptom | Check / action |
| --- | --- |
| `docker` is not recognized | Restart PowerShell after installation; confirm Docker Desktop is installed and running. |
| Docker says WSL needs updating | Follow the Docker Desktop WSL prompt, reboot if requested, then relaunch Docker Desktop. |
| Port 3000 or 8000 is busy | Stop the conflicting local application, or change the host port in `docker-compose.yml`. |
| Web shows API unavailable | Run `docker compose ps`; wait for the API health check to become healthy, then refresh. |
| Live workflow reports an Agent error | Confirm `.env` has a valid provider key, then inspect the local QwenPaw console and all four agent IDs. |
| Need a fresh demo database | Run `docker compose down -v`, then `docker compose up --build`. This deletes local Docker demo volumes only. |

For the actual presentation sequence, use [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

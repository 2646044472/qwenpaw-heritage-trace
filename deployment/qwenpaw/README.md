# QwenPaw live template

This directory contains only the four Heritage Trace agent definitions needed
by the live competition workflow. It contains no credentials, sessions,
chat/history databases, browser/login state, account settings, or personal
paths.

`docker-compose.live.yml` copies `working-template` into the named
`qwenpaw_working` volume the first time it starts. It keeps three named volumes:

- `qwenpaw_working` for agent configuration and working files;
- `qwenpaw_secrets` for QwenPaw-managed secrets; and
- `qwenpaw_backups` for backups.

Configure provider credentials in the local QwenPaw Console; QwenPaw keeps
them in `qwenpaw_secrets`, a local Docker volume outside Git. An ignored
repository-root `.env` is also supported for provider variables when the local
QwenPaw release supports them. The live composition intentionally exposes the
console only at `127.0.0.1:8088`. The fixture demo does not start QwenPaw and
needs no key. Ordinary `docker compose down` preserves the volumes; only
`down -v` deletes this local configuration.

If a local QwenPaw image/release uses a different configuration schema or
provider-variable name, set `QWENPAW_IMAGE` and the provider variables in the
local `.env` after validating that release. The API expects the console's
`GET /api/agents` and `POST /api/console/chat` interfaces and the four IDs in
`working-template/config.json`.

## Permission boundary

The live template enables the tools needed by the project: agents may read,
create, edit, append, search, and preview files in their own workspace, and
may use `web_search`/`web_fetch` for public-source research. The API service
retains write access to its SQLite workflow database. QwenPaw agents do not
receive shell or Python execution, browser/desktop control, MCP, inter-agent
management, or file-transfer tools. File Guard protects the secret volume and
common credential paths, and previews outside the workspace are disabled.

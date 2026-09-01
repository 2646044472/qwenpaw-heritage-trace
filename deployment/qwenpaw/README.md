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

Provider credentials belong in the ignored repository-root `.env` file. The
live composition intentionally exposes the QwenPaw console only at
`127.0.0.1:8088`. The fixture demo does not start QwenPaw and needs no key.

If a local QwenPaw image/release uses a different configuration schema or
provider-variable name, set `QWENPAW_IMAGE` and the provider variables in the
local `.env` after validating that release. The API expects the console's
`GET /api/agents` and `POST /api/console/chat` interfaces and the four IDs in
`working-template/config.json`.

# QwenPaw Project Instructions

## Product Scope

This repository is QwenPaw Heritage Trace: a competition demonstration of a
cultural-asset workflow for Macau heritage businesses and districts. It has
two distinct surfaces:

1. A public, no-login six-step competition demo that tells the proposal story.
2. A protected administration workspace for later project, source, verification, and
   publication work.

The default experience must let a judge understand this exact proposal arc in
minutes: a scattered old-shop story is searched, diagnosed for gaps, supported
by sources, structured into a cultural-asset card, verified, then reused for
G/B/C scenarios. Do not lead with login, infrastructure, account management,
or generic AI language.

Do not treat the current demo content as verified historical data. Do not add
real interviews, contact information, unpublished merchant details, family
details, or images without explicit authorisation and an agreed public scope.

## Repository Map

- `frontend/`: public demo, management UI, styles, static assets and browser API client.
- `backend/server/app.py`: Python standard-library API and SQLite persistence.
- `backend/`: Docker and local-backend configuration.
- `contracts/`: versioned frontend-result contract shared with the AWS backend.
- `deploy/`: Linux systemd, environment, and reverse-proxy templates.
- `澳憶千尋QwenPawHeritageTrace.docx`: product proposal, not runtime data.

## Security Is a Functional Requirement

Never implement a fake client-side login or client-side-only access control.
Authentication, authorisation, and validation must happen on the server.

When changing API code:

- Require an authenticated session for every non-public route.
- Require and verify a CSRF token for every state-changing request.
- Add explicit server-side role checks for each write operation. The current
  database has roles, but API role enforcement is not complete; do not claim
  it is complete until every route is tested.
- Keep Session cookies `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter.
  `QWENPAW_COOKIE_SECURE=0` is local HTTP development only.
- Do not add public account registration, default passwords, password hints, or
  password values in code/configuration.
- Store password hashes only. Prefer Argon2id when a vetted dependency can be
  installed and maintained; the current dependency-free implementation uses
  Python `hashlib.scrypt` and must not be weakened.
- Log security-relevant actions without logging secrets, passwords, raw session
  tokens, or sensitive document contents.
- Validate request bodies and maintain strict byte limits. Future upload routes
  require type/signature validation, generated filenames, size limits,
  quarantine/scanning, and non-executable storage.

## Data and Privacy

- Mark Demo data clearly and keep it separate from real data.
- A source marked `pending` or `internal` must not appear on a public page or
  public API response.
- Preserve source attribution and the public/internal status when generating
  derivatives such as POI copy, social material, or routes.
- Do not add analytics, tracking pixels, external fonts, external scripts, or
  third-party data calls without reviewing privacy, CSP, availability, and
  consent impact.

## Frontend Expectations

- This is a heritage-record and review tool, not a generic AI product. Prefer
  calm, legible, work-focused interaction and actual archive/verification
  workflows over AI terminology or decorative effects.
- State implementation truthfully: Archivist and Verifier are the working
  capabilities; Miner, Interviewer, Graph, and Insight are clearly labelled
  as demo workflow/data unless their backend is implemented and verified.
- The public Demo must not require a judge to create an account, know a test
  password, or make a network request to see the main six-step storyline.
- Use the existing visual system and Lucide icon language consistently.
- Keep all controls keyboard reachable, visibly focused, and large enough to
  operate on touch devices.
- Preserve the Chinese Traditional UI text unless a product decision changes it.
- Do not expose controls that a signed-in role is not authorised to execute;
  however, remember that hidden controls are a usability measure, not security.

## Deployment Constraints

The planned Tencent Cloud host also runs Minecraft. Website work must never
alter the Minecraft directory, service, tmux session, backups, Java runtime,
game port, firewall policy, or game user.

Before any remote action, read:

- `C:\Users\bankey\Desktop\file\cloud\AGENT.md`
- `C:\Users\bankey\Desktop\file\cloud\ssh-tool\DELTA_AI_RUNBOOK.md`

Deployment requirements:

- Use a dedicated unprivileged `qwenpaw` Linux account and separate directories
  under `/srv` and `/var/lib`.
- Bind the API to `127.0.0.1` only; expose it through Caddy or Nginx on HTTPS.
- Never expose Python, Vite, Node development, SQLite, or administration ports
  directly to the internet.
- Use a real domain, TLS, `QWENPAW_COOKIE_SECURE=1`, restrictive headers, and a
  narrow CSP.
- The public demo may be public. Restrict the login/admin/API/upload surface
  with VPN, identity-aware access, or a reverse-proxy IP allowlist where the
  administrators have stable addresses.
- Do not upload private keys, environment files, databases, world data, logs,
  passwords, or tokens.
- Use versioned releases and rollback; do not overwrite a live deployment in
  place.

## Verification

Before handing off changes:

```powershell
node --check frontend\app.js
python -m py_compile backend\server\app.py
```

For authentication/API changes, create an isolated temporary database and
verify successful login, invalid login, rate limiting, unauthenticated access,
CSRF rejection, role rejection, Session expiry, logout, and audit log writes.
For UI changes, verify desktop and mobile layouts, keyboard focus, error
feedback, loading states, and that unauthorised buttons do not appear.

Do not deploy, change security groups, alter firewall rules, create users, or
restart services without the user explicitly approving that remote change after
a read-only server audit.

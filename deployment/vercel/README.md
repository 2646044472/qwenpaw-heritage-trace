# Vercel deployment

The Vercel project root is `apps/web`. Vercel detects Next.js from the included
`vercel.json`, so the default build command (`npm run build`) is sufficient.

## Canonical production URL

Use [https://heritage-trace.vercel.app/](https://heritage-trace.vercel.app/) as
the public website address. The generated `*.vercel.app` deployment URLs are
for deployment inspection only.

## Deploy from the CLI

From `apps/web`:

```powershell
npx vercel --prod
```

The CLI prints the generated `https://<project-name>.vercel.app` address after
the deployment finishes.

## API connection

The frontend's Next.js route handlers proxy workflow and Pawly requests to the
URL in the server-only `API_BASE_URL` environment variable. Leave it unset for
the deterministic demo: workflow requests then use the browser's built-in demo
fallback. For live workflows, set `API_BASE_URL` in Vercel Project Settings to
a dedicated HTTPS API origin that is publicly reachable from Vercel. The
current `https://101.43.89.128/` site proxies `/api` back to the web container,
so it must not be used as `API_BASE_URL` unless nginx exposes the Python API on a
separate origin.

## Git integration

When importing the GitHub repository, select `apps/web` as **Root Directory**.
Every push to the selected production branch will then create a new Vercel
deployment and update the canonical alias above.

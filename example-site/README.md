# Example site

A dependency-free static site for testing any of the hosting approaches in this repo — general
hosting, basic-auth, and the `jwt-auth-gateway` SPA scenario. No build step: plain HTML/CSS/JS,
lightly branded for HerdingBits (Feebee says hello).

## Upload

Run from the `example-site/` directory:

```bash
_dev/scripts/deploy-site.sh <BucketName>
# or with a profile / region:
AWS_PROFILE=myprofile _dev/scripts/deploy-site.sh <BucketName> us-east-1
```

The script syncs the **contents** of `src/` to the bucket root (the landing page sits at `/`,
apps under `/app/`). `<BucketName>` is the hosting stack's `BucketName` output.

## What each path tests

| Path | Scenario | Expected |
|---|---|---|
| `/` | General hosting (public landing) | Served without login — the gate makes `/` public (`PUBLIC_PATHS=/`) |
| `/public/assets/site.css` | Public assets, no gate | Served without login — `/public/*` has its own function-free CloudFront behaviour |
| `/app` | Basic auth — the gate | No session → redirect to login, back to `/app` after |
| `/app/dashboard` | Advanced SPA | Served after login; client-side router |
| `/app/dashboard/reports/42` | SPA **deep link** | Full reload resolves to the SPA's `index.html`; the router renders the route — no 404 |

### The /public and /app split

- **`/public/*` — static assets only** (CSS, images, JS). Its own CloudFront behaviour with **no
  function attached**: truly public, zero per-request cost, the gate never runs. No HTML pages here.
- **`/app/*` — all pages/SPAs.** Gated by default. To make one public *and* keep its SPA deep-link
  rewriting, add it to `PUBLIC_PATHS` (the gate still runs, it just skips the login check).
- **`/` — the landing page**, made public by the gate via `PUBLIC_PATHS=/`.

For the jwt-auth-gateway scenario, pair this with its verification runbook:
[`jwt-auth-gateway/_docs/VERIFICATION.md`](../jwt-auth-gateway/_docs/VERIFICATION.md).

## Layout

```
example-site/
  README.md                   this file
  _dev/scripts/deploy-site.sh upload script (run from example-site/)
  src/                        the site itself (synced to the bucket root)
    index.html                landing page at /, made public via PUBLIC_PATHS=/
    public/assets/            CSS + favicon — truly public, no gate (own CloudFront behaviour)
    app/index.html            protected shell at /app (login required)
    app/dashboard/index.html  SPA; serves every /app/dashboard/* route (deep links)
```

The matching gate behaviour (jwt-auth-gateway, `APP_BASE_PATH=/app`): an extensionless path like
`/app/dashboard/reports/42` is rewritten to `/app/dashboard/index.html`, and the client router in
that file reads `location.pathname` to render the view.

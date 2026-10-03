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
| `/` | General hosting (public landing) | Served without login |
| `/public/` | `PUBLIC_PATHS` rule | Served without login |
| `/app` | Basic auth — the gate | No session → redirect to login, back to `/app` after |
| `/app/dashboard` | Advanced SPA | Served after login; client-side router |
| `/app/dashboard/reports/42` | SPA **deep link** | Full reload resolves to the SPA's `index.html`; the router renders the route — no 404 |

For the jwt-auth-gateway scenario, pair this with its verification runbook:
[`jwt-auth-gateway/_docs/VERIFICATION.md`](../../jwt-auth-gateway/_docs/VERIFICATION.md).

## Layout

```
example-site/
  README.md                   this file
  _dev/scripts/deploy-site.sh upload script (run from example-site/)
  src/                        the site itself (synced to the bucket root)
    index.html                landing page, public
    assets/                   shared CSS and favicon (HerdingBits sky-blue in the header)
    public/index.html         a page under PUBLIC_PATHS, no login
    app/index.html            protected shell at /app (login required)
    app/dashboard/index.html  SPA; serves every /app/dashboard/* route (deep links)
```

The matching gate behaviour (jwt-auth-gateway, `APP_BASE_PATH=/app`): an extensionless path like
`/app/dashboard/reports/42` is rewritten to `/app/dashboard/index.html`, and the client router in
that file reads `location.pathname` to render the view.

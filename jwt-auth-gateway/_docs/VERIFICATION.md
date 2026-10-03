# Verifying a deployment

A clean `provision.sh` + `deploy-code.sh` run means the resources *exist* — not that the auth
flow *works*. This checks the whole chain from the outside in, bottom layer first, so a failure
tells you which layer broke rather than just "it doesn't work".

Run the checks in order. Each one assumes the ones before it passed.

Set these once (from the stack outputs and your `.env`):

```bash
SITE=https://<DistributionDomainName>        # or your custom domain
PROFILE=<your-profile>                        # omit --profile below if using the default
REGION=ap-southeast-2                         # your Cognito region (NOT us-east-1)
POOL_ID=<CognitoUserPoolId>
```

---

## Step 0 — Upload the example site

The checks below assume content is in the bucket. This repo ships a dependency-free test site
(`example-site/`) that exercises every path the layers test — general hosting, a public path,
the login gate, and an SPA with deep links. Upload it first.

From the **`example-site/`** directory:

```bash
_dev/scripts/deploy-site.sh <BucketName>
# with a profile:  AWS_PROFILE=$PROFILE _dev/scripts/deploy-site.sh <BucketName>
```

`<BucketName>` is the hosting stack's `BucketName` output. The script syncs `src/` to the bucket
root, so `/` is the landing page and the apps live under `/app/`. See
[`../../example-site/src/README.md`](../../example-site/src/README.md) for the path-to-scenario map.

---

## Layer 1 — The distribution is serving

```bash
curl -sI "$SITE/" | head -1
```

**Expect `HTTP/2 200`** — with the example site uploaded, `/` is the public landing page, so it
is served without a login. (If you deployed your *own* content and made the root protected,
expect `302` to `/_auth/signin` instead.) A **403** means the gate is attached but S3 has no
object at `/` — did the upload (Step 0) run? The gate's redirect behaviour is tested at `/app`
in Layer 2.

---

## Layer 2 — The gate is making the right decisions

The gate's logic is testable from the outside by watching status codes. These use the example
site's paths; no session cookie on any of them:

```bash
# Protected page, no session -> 302 to sign-in
curl -sI "$SITE/app" | grep -iE 'HTTP|location'

# Asset request (has an extension), no session -> 401, NOT a redirect
curl -sI "$SITE/app/does-not-exist.js" | head -1

# Malformed / non-normalised path -> 400 before any other decision
curl -sI "$SITE//app" | head -1

# A public path (PUBLIC_PATHS, default /public) -> served, no redirect
curl -sI "$SITE/public/" | head -1
```

**Expect**, in order: `302` (+ `location: /_auth/signin?...`), `401`, `400`, and `/public/`
returning `200` (served without a login).

Why these differ: a page load should bounce a human to sign-in, but an asset (`.js`, `.css`)
must *fail* rather than redirect — returning the sign-in HTML in place of a script would wedge the
app. The `400` proves the path-confusion guard runs first. If every one of these returns the same
code, the gate isn't discriminating — suspect a stale `check-auth` deploy.

---

## Layer 3 — The auth endpoints are live (Lambda@Edge attached)

```bash
# signin starts the login -> 302 to the Cognito hosted UI
curl -sI "$SITE/_auth/signin?return=%2Fapp" | grep -iE 'HTTP|location'

# refresh with no refresh-token cookie -> 401 (it IS running, just nothing to refresh)
curl -sI -X POST "$SITE/_auth/refresh" | head -1
```

**Expect** the signin `302` to carry a `location` to
`https://<COGNITO_DOMAIN>/oauth2/authorize?...` (client_id, PKCE `code_challenge`, your
`redirect_uri`). The refresh **401** proves the Lambda is attached and executing.

> **If `/_auth/*` returns 403 instead:** the Lambda@Edge association hasn't propagated yet (give
> it 5–15 min after `deploy-code.sh`), or the first `deploy-code.sh` didn't attach it. Re-run
> `deploy-code.sh` and re-check. A 503 means the bootstrap stub is still live — code didn't deploy.

---

## Layer 4 — Cognito is configured for this host

Open the signin URL from Layer 3 in a browser:

```bash
echo "$SITE/_auth/signin?return=/app"
```

**Expect** the Managed Login page to render (branded, not a blank page). Two common failures:

- **"redirect_uri mismatch"** from Cognito → the callback flip (runbook step 6) didn't happen, or
  used a different host. The app client's callback must be exactly `$SITE/_auth/callback`.
- **A blank/unstyled page** → the `ManagedLoginBranding` resource didn't apply; check it exists in
  the Cognito stack.

---

## Layer 5 — End-to-end sign-in (the real test)

You need a user. Create one if you haven't:

```bash
aws cognito-idp admin-create-user --region "$REGION" --user-pool-id "$POOL_ID" \
  --username you@example.com \
  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true \
  --profile "$PROFILE"
```

Cognito emails a temporary password. Then, in a browser:

1. Visit `$SITE/app` → redirected to the Managed Login page.
2. Sign in (first login forces a password change).
3. **Expect** to land back at `$SITE/app` — now serving the app, not redirecting.
4. Open dev tools → Application → Cookies. **Expect** `__Host-id`, `__Host-idsig` (on `/`) and
   `__Secure-rt` (on `/_auth`). These are the session; their presence proves the full round trip
   (PKCE → code exchange → token verify → HMAC stamp) completed.
5. Reload the page a few times. It should stay signed in with no redirect — the gate is matching
   the stamp.
6. **Deep-link test:** from the `/app` shell, follow the link to the dashboard SPA, then visit a
   deep route directly (while signed in): `$SITE/app/dashboard/reports/42`. Expect the SPA to load
   at that route — the gate resolved the deep link to `/app/dashboard/index.html` and the client
   router rendered the report view. Reloading on that URL should still work, not 404.

---

## Layer 6 — The id-token actually expires (optional, confirms the 5-min lifetime)

The id-token is 5 minutes. The gate re-checks `exp`, so after 5 minutes an API call (or a
navigation) should trigger a silent refresh via `/_auth/refresh`, not a logout. To watch it:
sign in, wait >5 min, reload — you should stay signed in (the refresh token, valid 30 days,
mints a fresh id-token with no visible interruption).

---

## Layer 7 — The API path (only if `API_ORIGIN_DOMAIN` is set)

Not configured in the base demo. If you've wired an API origin:

```bash
# No session -> 401
curl -sI "$SITE/api/orders" | head -1
# Cross-site write without the Sec-Fetch-Site header -> 403 (CSRF guard)
curl -sI -X POST "$SITE/api/orders" -H 'origin: https://evil.example' | head -1
```

**Expect** `401` then `403`. The gate strips the session cookie and injects
`Authorization: Bearer <id-token>` only for same-origin requests with a valid session — the API
Gateway JWT authorizer then validates the token for real.

---

## Quick triage table

| Symptom | Most likely layer | Look at |
|---|---|---|
| `/` returns 200 for anonymous | Gate not attached | default behaviour's `FunctionAssociations` |
| Everything returns 403 | S3/OAC or stub still live | OAC policy; did `deploy-code.sh` run? |
| `/_auth/*` returns 403 | Lambda@Edge not associated/propagated | wait 5–15 min, re-run `deploy-code.sh` |
| `/_auth/*` returns 503 | bootstrap stub still live | `deploy-code.sh` didn't push code |
| Cognito "redirect_uri mismatch" | Callback not flipped | runbook step 6; app client callback URL |
| Blank login page | Managed Login branding | `ManagedLoginBranding` in the Cognito stack |
| Signed in but reload logs out | Session key mismatch | `SESSION_KEY` stable across gate + Lambda builds |

# JWT Auth Gateway

Puts a Cognito login in front of static single page apps hosted on S3 and CloudFront. It's built to host a [Trailhead](https://github.com/quicken/trailhead) shell and its apps, but it works with any set of SPAs that each live in their own folder.

- The whole login happens at the edge: OAuth authorisation code flow with PKCE against a **public** Cognito client. There is no OAuth client secret.
- Tokens live in `HttpOnly; Secure` cookies. No JavaScript in any hosted app can read them.
- The id-token expires hourly, but a page load refreshes it silently. API calls get a `401` and can refresh with one `POST`.
- Deep links like `/customers/42/orders` serve `/customers/index.html`, so each app's client-side router works.
- An optional same-origin `/api/*` proxy turns the session cookie into an `Authorization: Bearer` header for an API Gateway JWT authoriser. There is no CORS to deal with, and cross-site requests are refused.
- The check on every request is a **CloudFront Function**: sub-millisecond, at every edge location, no cold starts, about a sixth of Lambda@Edge's price per request. Lambda@Edge only runs for sign-in, refresh and sign-out.
- Infrastructure is plain CloudFormation: a private S3 bucket with Origin Access Control, a CloudFront distribution, one CloudFront Function and one Lambda@Edge function.

## How it works

```
Browser ──► CloudFront
             ├─ /_auth/*    auth-routes  Lambda@Edge          sign-in, callback, refresh, sign-out
             ├─ /api/*      check-auth   CloudFront Function  cookie → Bearer, or 401/403  ──► API origin
             └─ everything  check-auth   CloudFront Function  login gate + deep links      ──► S3 (cached)
```

| Request | Signed in | Not signed in |
| --- | --- | --- |
| Page (`/customers/42`, `*.html`) | Served from the app's `index.html` | `302` to `/_auth/signin?return=…` |
| Asset (`app.js`, `shell.json`, …) | Served as-is | `401` |
| `/api/*` from the site itself | Proxied with `Authorization: Bearer <id-token>` | `401` |
| `/api/*` from anywhere else | `403` | `403` |
| `PUBLIC_PATHS` (default `/public`) | Served | Served |
| A path CloudFront would normalise (`//x`, `/a/../b`, `%2e`, `\`) | `400` | `400` |

`/_auth/signin` first tries the refresh token and sends the user straight back. Only when that fails does it start the PKCE login with the Cognito hosted UI.

Both functions run at **viewer-request**, which fires on every request, cache hits included. Content cached for one signed-in user is therefore never served to someone who isn't signed in. Because the deep-link rewrite also happens there, every deep link into an app shares one cached copy of that app's `index.html`.

### Why a CloudFront Function plus a stamp

The gate runs on every request, so it needs to be as cheap and fast as possible: a CloudFront Function. CloudFront Functions can compute an HMAC but can't verify an RSA signature, so they can't check a Cognito token directly. Instead, `auth-routes` fully verifies the token (RS256 signature, issuer, audience, expiry, `token_use`) whenever it issues one. It then sets a second cookie, `__Host-idsig`: an HMAC over exactly that token, keyed with `SESSION_KEY`. On every request the gate recomputes that HMAC and checks the token's expiry. Only the edge can produce a valid stamp, so a forged or altered token gets nowhere.

This does add one secret: `SESSION_KEY`. Anyone who has it can mint sessions for the static content, though not for the API, whose JWT authoriser verifies the token itself. It ends up in the generated `dist/hosting.yaml`, in the deployed function code, in the deployment artefacts bucket, and in your `.env`. Treat read access to the stack's template, the CloudFront Function, the Lambda code and that bucket as access to the key. See [Rotating the session key](#rotating-the-session-key).

### Paths and cross-site requests

CloudFront picks a cache behaviour using the *normalised* path, but hands edge functions and origins the *raw* one. The gate therefore refuses any path that would normalise differently (`//billing`, `/docs/../billing`, `%2e`, `%2f`, backslashes) with a `400` before deciding anything. A path is never judged as one thing and served as another.

Because the gate turns the session cookie into a Bearer token, `/api/*` only accepts requests the site itself made. Writes need `Sec-Fetch-Site: same-origin`, or a matching `Origin` from browsers that don't send it. Reads also accept `Sec-Fetch-Site: none` (a URL typed into the address bar). Cross-site and sibling-subdomain requests get a `403`. Keep `GET` endpoints free of side effects.

### Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /_auth/signin?return=/path` | Refresh or log in, then return to `/path` (same-site paths only) |
| `GET /_auth/callback` | Cognito redirect target: redeems the code with the PKCE verifier |
| `POST /_auth/refresh` | `204` plus a new id-token cookie, or `401` when the session is gone |
| `GET /_auth/signout` | Revokes the refresh token, clears the cookies, ends the Cognito session |

### Cookies

| Cookie | Path | Holds |
| --- | --- | --- |
| `__Host-id` | `/` | Cognito id-token. Its lifetime matches the token's. |
| `__Host-idsig` | `/` | HMAC stamp over the id-token, checked by the gate on every request. |
| `__Secure-rt` | `/_auth` | Refresh token. It only ever travels to `/_auth/*`. |
| `__Secure-flow` | `/_auth` | PKCE verifier, CSRF state and return path, HMAC-signed. Kept for 10 minutes during sign-in. |

## Deploy

Just want to try it? [`terraform/`](terraform/README.md) spins up a pool, the hosting and a demo user with one command (`./up.sh`), and tears it all down again. The steps below are the reference deployment.

Prerequisites: Node.js 24+, the AWS CLI, and an existing S3 bucket in **us-east-1** for the deployment artefacts.

### 1. Cognito

Skip this step if you already have a user pool. Otherwise:

```bash
aws cloudformation deploy \
  --region ap-southeast-2 \
  --stack-name static-hosting-auth \
  --template-file cloudformation/cognito.yaml \
  --parameter-overrides DomainPrefix=my-apps-login SiteHost=apps.example.com
```

`SiteHost` is the host your apps are served from. Without a custom domain you don't know it yet: put a placeholder, deploy the hosting stack, then re-run this command with its `DistributionDomainName` output. The Cognito values are baked into the build, but the host is not, so this needs no rebuild.

If you bring your own pool, the app client must be a public client (no secret) with the authorisation code grant, the `openid email profile` scopes, callback URL `https://<host>/_auth/callback`, and sign-out URL `https://<host>/`.

### 2. Configure

```bash
cp .env.example .env
```

Fill in the Cognito outputs, `STACK_NAME` and `DEPLOY_BUCKET`, and generate a `SESSION_KEY` with `openssl rand -base64 32`. Optionally set `DOMAIN_NAME`/`CERTIFICATE_ARN` and `API_ORIGIN_DOMAIN`. Every setting is documented in [.env.example](.env.example).

### 3. Deploy the hosting stack

```bash
npm install
npm run deploy
```

`deploy.sh` does the following:

1. builds `auth-routes` (baking in the configuration and the pool's public signing keys) and the CloudFront Function gate
2. writes `dist/hosting.yaml` with the gate's code embedded, since CloudFormation takes CloudFront Function code inline
3. zips `auth-routes`, then runs `aws cloudformation package` and `aws cloudformation deploy` against us-east-1
4. prints the stack outputs

The CloudFront Function updates within minutes. Each deploy also publishes a new `auth-routes` version; allow 5–15 minutes for its edge replicas.

### 4. Upload your apps

```bash
aws s3 sync ./site s3://<BucketName>/ --delete --cache-control "no-cache"
```

With `no-cache`, CloudFront holds each file for the cache policy's 1-second minimum and then revalidates with S3 (cheap `304`s), so a release is live almost immediately. That matters for Trailhead, whose `index.html`, `shell.json` and `app.js` keep the same names across releases. If you prefer long TTLs, invalidate after each upload instead.

## Using it with Trailhead

Trailhead's deployment layout works as-is: the shell at the root, each app in a sibling folder.

```
s3://<BucketName>/
├── index.html          shell
├── shell.js, shell.css, shell.json
├── webawesome/         design system assets
├── customers/
│   ├── index.html      copy of the shell HTML
│   └── app.js
└── public/             optional, served without a login
```

- **Public and members-only apps.** By default everything outside `PUBLIC_PATHS` needs a login, including the shell. To make some apps public, make the shell's own files public too, and every app not listed stays behind the login:

  ```bash
  PUBLIC_PATHS=/,/index.html,/shell.js,/shell.css,/shell.json,/webawesome,/docs
  ```

  Anonymous visitors get the shell and `/docs`. Following a nav link to `/billing` sends them through sign-in and back to `/billing`. Note that `shell.json`, and therefore the names of the members-only apps, is then public.
- **Base path.** With `APP_BASE_PATH` empty, `/customers/*` resolves to `/customers/index.html`. If the site lives under a folder (Trailhead's `appBasePath`, e.g. `/apps`), set `APP_BASE_PATH` to the same value.
- **API.** Point the shell at the same-origin proxy, `new Trailhead({ ..., apiUrl: "/api" })`, and set `API_ORIGIN_DOMAIN`. `shell.http.get("/orders")` then reaches `https://<api>/orders` carrying the user's id-token. There's no CORS and no token handling in the app.
- **Sign-out.** Add a nav link to `/_auth/signout` with `"external": true` so the shell doesn't prefix it with `appBasePath`.
- **Expired sessions.** A page load or a Trailhead navigation (a full page load by design) refreshes silently. An API call made after the id-token expires gets a `401`. Wrap calls that may run long after page load:

```typescript
import type { Result } from "@herdingbits/trailhead-types";

/**
 * Runs a shell.http call and, on a 401, refreshes the edge session once and retries. If the
 * session can't be refreshed, goes through sign-in and comes back to this page.
 */
export async function withSession<T>(call: () => Promise<Result<T>>): Promise<Result<T>> {
  const result = await call();
  if (result.success || result.error.status !== 401) {
    return result;
  }
  const refreshed = await fetch("/_auth/refresh", { method: "POST" });
  if (refreshed.ok) {
    return call();
  }
  window.location.assign(`/_auth/signin?return=${encodeURIComponent(location.pathname + location.search)}`);
  return result;
}
```

The first `401` still triggers the shell's error toast. Pass `noFeedback: true` on calls wrapped this way if that's noisy.

Trailhead's in-place `shell.auth.reauthenticate()` prompt collects a username and password. That doesn't fit a hosted-UI login, so it isn't used here.

## Develop

```bash
npm install
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run build       # needs .env; SKIP_JWKS_BAKE=1 skips the signing key fetch
```

Source layout:

```
src/cloudfront/check-auth.ts  CloudFront Function entry for the gate
src/aws/auth-routes.ts        Lambda@Edge /_auth/* endpoints
src/lib/gate.ts               the gate's logic (runs in the CloudFront Functions runtime)
src/lib/                      routing, session stamp, cookies, JWT verification, OAuth/PKCE, responses
tools/bundle-cloudfront.ts    bundles the gate into CloudFront Functions code
src/types/config.ts      build-time configuration shape
cloudformation/          hosting.yaml (us-east-1), cognito.yaml (optional, any region)
terraform/               OpenTofu demo rig: up.sh / down.sh
```

## Rotating the session key

1. Move the current `SESSION_KEY` to `SESSION_KEY_PREVIOUS`.
2. Generate a new `SESSION_KEY`, then `npm run deploy`. The gate accepts both keys, so nobody is signed out while the edge replicas catch up.
3. On a later deploy (after an hour, when every stamp made with the old key has expired), clear `SESSION_KEY_PREVIOUS`.

Don't change `SESSION_KEY` without step 1. The CloudFront Function updates faster than the Lambda@Edge replicas, so for a few minutes after the deploy they would disagree about the key.

## Things to know

- **Configuration is baked in.** Neither function type has environment variables. Changing `.env` means rebuilding and redeploying.
- **Code for the gate must suit the CloudFront Functions runtime.** Anything `src/lib/gate.ts` imports avoids destructuring, spread, default parameters, for-of and classes. The bundle test runs the real bundle in a sandbox that offers only what that runtime does, and fails on unsupported syntax.
- **Signing key rotation.** When Cognito rotates its signing keys, the functions fetch the new ones on first sight, at most once every 5 minutes per container. Redeploying bakes them in again.
- **Deleting the stack.** CloudFormation can't delete Lambda@Edge functions until CloudFront has removed their replicas, which can take hours. If the delete fails, wait and retry. The S3 bucket, the Cognito pool and old function versions are retained on purpose.
- **Missing files return 403, not 404.** CloudFront deliberately can't list the bucket.
- **Per-user content.** Everything served from S3 is cached by URL. Never put per-user files there without giving them their own uncached behaviour.

## Licence

MIT. See [LICENSE](../LICENSE).

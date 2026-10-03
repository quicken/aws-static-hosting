# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What This Is

Static hosting for single page apps on S3 + CloudFront, gated at the edge by a CloudFront Function (Lambda@Edge serves only `/_auth/*`). The main project, `jwt-auth-gateway`, is designed to host a [Trailhead](../trailhead) shell and its apps.

No root `package.json`. Each folder is independent with its own `npm install`.

```
jwt-auth-gateway/   Cognito login at the edge + CloudFormation (the main project)
basic-auth/         Legacy tutorial function (YouTube), kept as-is
```

## Commands (jwt-auth-gateway)

```bash
npm test            # vitest, node environment
npm run typecheck   # tsc --noEmit
npm run build       # needs .env; SKIP_JWKS_BAKE=1 to skip the JWKS fetch
npm run deploy      # build + package + deploy the hosting stack to us-east-1
```

## Conventions

These follow Trailhead:

- ES modules only (`"type": "module"`). The Lambda@Edge handler (`src/edge-auth/`) bundles to `dist/auth-routes.mjs`. The gate (`src/cloudfront-gate/`) bundles to CloudFront Functions code via `tools/bundle-cloudfront.ts`.
- Exported `function` declarations, `import type`, `interface` over `type` (unions excepted).
- 2-space indent, double quotes in `src/`, single quotes in tests.
- Module-level JSDoc explains *why*, not what.
- Tests live in `__tests__/*.test.ts`.

## Source Layout

`src/` is organised by deployment target, so each folder's runtime is unambiguous:

```
src/
  lib/              shared code imported by both functions — CloudFront Functions runtime
                    constraints apply here (see Design Constraints). constants, routing, session.
  cloudfront-gate/  the viewer-request gate (CloudFront Function). index.ts is the entry point.
  edge-auth/        the /_auth/* OAuth handler (Lambda@Edge). index.ts is the entry point;
                    full Node.js is available here (crypto, fetch).
  types/            shared type declarations.
```

Each handler folder owns its own helpers and exposes `index.ts` as its entry point. The build
pins the output artefact names (`dist/auth-routes.mjs`, `dist/check-auth.cf.js`) regardless of
source location, because those names are a contract with the CloudFormation/OpenTofu templates.

## Design Constraints

Don't suggest approaches that work around these:

- **Neither function type has environment variables.** Configuration is baked in at build time: `EDGE_CONFIG` for Lambda@Edge, `GATE_CONFIG` for the CloudFront Function (esbuild `define`). Don't add runtime config lookups.
- **The per-request gate is a CloudFront Function; Lambda@Edge only serves `/_auth/*`.** Don't move per-request work back to Lambda@Edge. The gate can't do RSA or network calls, so it trusts an HMAC stamp (`src/lib/session.ts`) that auth-routes sets after fully verifying the Cognito token.
- **Code reachable from `src/cloudfront-gate/gate.ts` must run in the CloudFront Functions runtime:** no destructuring, spread, default parameters, for-of, classes or Node APIs. `__tests__/cloudfront-bundle.test.ts` enforces this.
- **Both functions run at viewer-request.** The gate must run on cache hits, and viewer-request is where the Host header and cookies are available without forwarding them to S3. Don't move auth to origin-request.
- **Decide on normalised paths only.** CloudFront matches behaviours on the normalised path but passes the raw one on. The gate rejects non-normalised paths first; keep it that way.
- **No token is ever readable by JavaScript.** Cookies are always `HttpOnly; Secure`. Don't add endpoints that return tokens in a body.
- **Never log tokens or cookie values.** Log verification *reasons* only.
- **Every redirect target taken from a request goes through `safeReturnPath`.**
- **`SESSION_KEY` is a secret.** Never commit `dist/` (the generated template embeds it) or `.env`.
- **Infrastructure is CloudFormation** (`jwt-auth-gateway/_dev/cloudformation/`). No CI/CD pipelines in this repo.
- **After any `provision.sh`, re-run `deploy-code.sh`.** The hosting stack doesn't own the `/_auth/*` Lambda@Edge association (`deploy-code.sh` attaches it out-of-band), so re-provisioning drops it and `/_auth/*` 403s until the next code deploy.
- **`jwt-auth-gateway/_dev/terraform/` is a disposable OpenTofu demo rig**, not a second source of truth. Change the CloudFormation templates first, then mirror the change there. It needs OpenTofu: its state holds the session key (inside the gate's code), and `env.sh` enforces state encryption through `TF_ENCRYPTION`.

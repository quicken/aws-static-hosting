# Demo rig (OpenTofu)

Spins up the whole gateway with one command, to try it out, and tears it down again. The
CloudFormation templates in `../cloudformation` remain the reference; this mirrors them for
convenience and doesn't retain anything on the way out.

```bash
DEMO_EMAIL=you@example.com ./up.sh
./down.sh          # hosting only; keeps the pool and its users
./down.sh --all    # everything, including the secrets
```

Prerequisites: [OpenTofu](https://opentofu.org) 1.8+, Node.js 24+, the AWS CLI with credentials,
and `openssl`. No deployment bucket needed.

```
cognito/   user pool, hosted UI domain, PKCE app client   (COGNITO_REGION, default ap-southeast-2)
hosting/   bucket, CloudFront, the gate, Lambda@Edge       (always us-east-1)
env.sh     secrets and state encryption, shared by both scripts
```

Two modules with their own state, so the pool (and your demo users) can outlive a rebuild of the
hosting side.

## What `up.sh` does

1. Applies `cognito/`.
2. Builds the functions with the pool's IDs from the Cognito outputs, not `.env`.
3. Applies `hosting/`.
4. On the first run without a custom domain, applies `cognito/` again to register the new
   CloudFront domain as the callback URL. The build doesn't need the host, because the callback
   URL is derived from the request.
5. Optionally uploads a site (`SITE_DIR`) and creates a user (`DEMO_EMAIL`). Cognito emails the
   temporary password.

| Variable | Default | |
|---|---|---|
| `NAME` | `trailhead-demo` | Prefix for everything, including the SSM parameters |
| `COGNITO_REGION` | `ap-southeast-2` | |
| `DOMAIN_NAME`, `CERTIFICATE_ARN` | | Custom domain; the certificate must be in us-east-1 |
| `SITE_DIR`, `SITE_PREFIX` | | Built site to sync into the bucket, and the key prefix to put it under |
| `DEMO_EMAIL` | | User to create |
| `APP_BASE_PATH`, `PUBLIC_PATHS`, `API_ORIGIN_DOMAIN`, `API_PREFIX` | as in `.env.example` | Baked into the functions |
| `CACHE_ENABLED` | `true` | Set `false` to bypass the cache on the static behaviours (default + `/public/*`) while developing; `/_auth/*` and the API are never cached |

The Trailhead Web Awesome example builds for `/sample/trailhead/webawesome` by default, so put it
there:

```bash
SITE_DIR=../../../../trailhead/examples/webawesome-site/dist \
SITE_PREFIX=sample/trailhead/webawesome \
APP_BASE_PATH=/sample/trailhead/webawesome \
./up.sh
```

## The session key and the state

The session key signs the cookie the gate checks on every request. Terraform never takes it as a
variable: `build.mjs` bakes it into the gate's code, and `hosting/` reads the built file. That
means the key is inside the state, as the `code` of the CloudFront Function. So:

- **Both secrets live in SSM Parameter Store** as SecureStrings (`/$NAME/session-key` and
  `/$NAME/state-passphrase`, in us-east-1), created on first run. They stay stable across runs,
  which the session key must. Set `SESSION_KEY` or `TF_STATE_PASSPHRASE` yourself to bring your
  own instead.
- **The state is encrypted** with OpenTofu's state encryption, configured through
  `TF_ENCRYPTION` in `env.sh` and enforced, so it can never be written in plain text. This is why
  the rig needs OpenTofu rather than Terraform, which has no equivalent. Lose the passphrase and
  the state is unreadable.
- **Plans don't show it.** The gate's code is marked sensitive.
- **State files are git-ignored.** Encrypted or not, they don't belong in the repo.

## Tearing down

Lambda won't delete a Lambda@Edge function while CloudFront still has replicas of it, and those
take hours to clear after the distribution goes. So `destroy` forgets the function instead
(`skip_destroy`), and `down.sh` prints the `aws lambda delete-function` command to run later.

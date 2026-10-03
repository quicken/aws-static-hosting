# Deployment

A start-to-finish runbook for standing up the whole stack: a Cognito login, the private
CloudFront + S3 hosting, and the two edge functions. Follow it top to bottom the first time.

The pieces are deliberately in **two CloudFormation stacks** and deployed by **two scripts**, so
each concern moves on its own:

- **Cognito stack** (`_dev/cloudformation/cognito.yaml`) — the login experience. Any region.
- **Hosting stack** (`_dev/cloudformation/hosting.yaml`) — bucket, CloudFront, edge-function
  shells. Always **us-east-1** (Lambda@Edge must live there).
- **`_dev/scripts/provision.sh`** — deploys the hosting stack **once**.
- **`_dev/scripts/deploy-code.sh`** — rolls out function code on every change, no stack update.

Prerequisites: Node.js 24+, the AWS CLI, `jq`, and `openssl`.

> **The one ordering knot.** Cognito's sign-in callback needs the site's host, but the host only
> exists once hosting is deployed. We break the loop in two passes: provision Cognito with a
> placeholder, deploy hosting, then update Cognito with the real host (step 6). Until then,
> sign-in cannot complete — that is expected, not a fault.

---

## 1. Provision Cognito (placeholder callback)

`DomainPrefix` is globally unique (like an S3 bucket name) and becomes your login URL,
`https://<prefix>.auth.<region>.amazoncognito.com`. Leave `SiteHost` off for now.

```bash
aws cloudformation deploy \
  --region ap-southeast-2 \
  --stack-name saas-login \
  --template-file _dev/cloudformation/cognito.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainPrefix=<your-unique-prefix> \
  --profile <your-profile>
```

Read its outputs — you need all four for the next step:

```bash
aws cloudformation describe-stacks --stack-name saas-login \
  --query 'Stacks[0].Outputs' --output table \
  --region ap-southeast-2 --profile <your-profile>
```

| Output | Goes into `.env` as |
|---|---|
| `CognitoRegion` | `COGNITO_REGION` |
| `CognitoUserPoolId` | `COGNITO_USER_POOL_ID` (also the JWKS issuer the gate trusts) |
| `CognitoClientId` | `COGNITO_CLIENT_ID` (also the `aud` the API authorizer must expect) |
| `CognitoDomain` | `COGNITO_DOMAIN` (hosted-UI host, no scheme) |

---

## 2. Generate the session key

This is a secret **you** generate — it is not an AWS output, which is exactly why it is easy to
miss. It is the HMAC key that signs the cookie the gate checks on every request.

```bash
openssl rand -base64 32
```

> **Generate it once and keep it stable.** The key is baked into *both* edge functions at build
> time. Changing it invalidates every existing session cookie (everyone is logged out) and, mid
> deploy, leaves the gate and auth-routes disagreeing until the Lambda@Edge replicas catch up. To
> rotate it later, use the `SESSION_KEY` → `SESSION_KEY_PREVIOUS` path in the README, not a bare
> regeneration.

---

## 3. Configure `.env`

```bash
cp .env.example .env
```

Fill in:

- the four `COGNITO_*` values from step 1,
- `SESSION_KEY` from step 2 (leave `SESSION_KEY_PREVIOUS` empty),
- `STACK_NAME` (e.g. `saas-hosting`),
- `PUBLIC_PATHS=/` so the root landing page is served without a login (the `/public/*` assets
  path is handled by its own CloudFront behaviour, not by this value),
- optionally `AWS_PROFILE` (unset = default profile).

Leave `DOMAIN_NAME`, `CERTIFICATE_ARN` and `API_ORIGIN_DOMAIN` empty for a first deploy. The
`APP_BASE_PATH` default is `/app` — the shell is served under `/app`, leaving the bucket root
free for a public landing page.

> **When the Cognito values are actually used.** They are baked into the function *bundles* at
> `npm run build`, which runs inside `deploy-code.sh` (step 5) — **not** at provision time
> (step 4). So `.env` must be correct before step 5; step 4 only reads `STACK_NAME` and the
> optional domain/API vars.

---

## 4. Provision the hosting stack (once)

```bash
_dev/scripts/provision.sh
```

Creates the bucket, CloudFront distribution, OAC, IAM role and the two function *shells* (with
bootstrap stubs). It prints the stack outputs — note `DistributionDomainName`, `BucketName` and
`DistributionId`. Re-running only reconciles infrastructure; it never carries code.

> **`/_auth/*` returns 403 now, and that is correct.** The Lambda has only a stub and no
> distribution association until the first `deploy-code.sh` run attaches it.

> **Dev-only: disable caching while troubleshooting.** The hosting stack takes a `CacheEnabled`
> parameter (`true`/`false`, default `true`) that toggles caching on the default and `/public/*`
> behaviours, so edits show up immediately without an invalidation. To turn it off, pass it on the
> provision call: `aws cloudformation deploy ... --parameter-overrides CacheEnabled=false` (or add
> `CacheEnabled` to `provision.sh`'s overrides). The `/_auth/*` and API behaviours are never cached
> regardless.

---

## 5. Deploy the function code

```bash
_dev/scripts/deploy-code.sh
```

Builds the bundles (baking in the Cognito config + the pool's JWKS), updates the CloudFront
Function gate in place, publishes a new Lambda@Edge version, and repoints the distribution's
`/_auth/*` behaviour at it. Re-run this for every code change — it never touches the stack.

> **Re-run `deploy-code.sh` after EVERY `provision.sh` — not just the first.** The hosting stack
> deliberately does not own the `/_auth/*` Lambda@Edge association (`deploy-code.sh` attaches it
> out-of-band via the AWS API, to keep the versioned-ARN churn out of the stack). So any
> `provision.sh` run — including one you do later to apply a stack change like `/public/*` or
> `CacheEnabled` — resets the distribution to the template and **drops that association again**,
> and `/_auth/*` goes back to returning 403 until you re-run `deploy-code.sh`. If sign-in suddenly
> 403s after a re-provision, this is why.

> The CloudFront Function is live within minutes; the Lambda@Edge replicas take **5–15 minutes**
> to propagate globally. Both are normal.

---

## 6. Flip the Cognito callback to the real host

Now that hosting exists, re-run step 1 **with** `SiteHost` set to the `DistributionDomainName`
output (or your custom domain). This swaps the placeholder callback for the real one.

```bash
aws cloudformation deploy \
  --region ap-southeast-2 \
  --stack-name saas-login \
  --template-file _dev/cloudformation/cognito.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainPrefix=<your-unique-prefix> SiteHost=<DistributionDomainName> \
  --profile <your-profile>
```

> **Sign-in is impossible until this step.** Steps 4–5 can succeed and the gate will work, but the
> OAuth round-trip fails while the callback still points at the placeholder.

---

## 7. Upload the SPA(s)

Content must live under `app/` in the bucket to match `APP_BASE_PATH=/app`.

```bash
aws s3 sync <your-built-site>/dist s3://<BucketName>/app \
  --delete --cache-control no-cache --profile <your-profile>
```

(`no-cache` lets a release go live at once; CloudFront still revalidates with S3 after its
one-second minimum.)

---

## 8. Create a sign-in user

```bash
aws cognito-idp admin-create-user \
  --region ap-southeast-2 \
  --user-pool-id <CognitoUserPoolId> \
  --username you@example.com \
  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true \
  --profile <your-profile>
```

Cognito emails a temporary password; the first sign-in asks for a new one.

---

## 9. Verify end-to-end

Open the `SiteUrl` output in a browser. You should be redirected to the Managed Login page, be
able to sign in, and land back on the site. If `/_auth/*` still 403s after a few minutes, the
Lambda@Edge replicas have not propagated yet — wait and retry.

---

## Tearing it down

```bash
# Hosting stack (us-east-1)
aws cloudformation delete-stack --stack-name <STACK_NAME> --region us-east-1 --profile <your-profile>
# Cognito stack (its region) — this DEMO stack is deletable; it takes the user pool with it.
aws cloudformation delete-stack --stack-name saas-login --region ap-southeast-2 --profile <your-profile>
```

> Lambda@Edge leaves replicas behind for a few hours after the distribution goes; the function
> cannot be deleted until they clear. A `delete-stack` on the hosting stack may report the Lambda
> as still in use — that resolves itself once the replicas expire.

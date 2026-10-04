# Use this in your own project

This repo is a **working, forkable edge-auth gateway**: a private S3 + CloudFront site
gated by a Cognito login at the edge. The design goal is that *using* it in your own
AWS account touches **almost no code** — you supply configuration, not changes. Your
customisation lives in one git-ignored file (`.env`) and your own IaC parameters; the
function logic in `src/` stays stock, so you can keep pulling upstream fixes.

## Two ways to start

**A. Use the GitHub template (your own clean repo).**
Click **"Use this template" → "Create a new repository"**. You get a fresh repo with no
fork relationship and clean history — yours to build on. Best if you just want your own
copy and don't need our later patches.

**B. Clone and track upstream (keep getting patches).**

```bash
git clone https://github.com/quicken/aws-static-hosting.git
cd aws-static-hosting
git remote add upstream https://github.com/quicken/aws-static-hosting.git
```

Best if you want our security/bug fixes to the Lambda@Edge and CloudFront Function code.
Pull them any time with:

```bash
git fetch upstream
git merge upstream/master      # or: git rebase upstream/master
```

Because everything you change is in `.env` (git-ignored) and IaC *variables* — never in
`src/` — these merges almost never conflict. Re-run `deploy-code.sh` after a merge to
roll the patched functions out.

> You can do both: start from the template **and** add an `upstream` remote. The template
> just removes the "forked from" link; the patch flow works either way.

## What you actually change

For a standard deployment, exactly one file: **`jwt-auth-gateway/.env`** (copy it from
`.env.example`). Everything the gateway needs — your Cognito pool, client, domain, the
session-signing key, your routing prefixes — is injected from there at build time. You do
**not** edit `src/`.

| You set | Where | What it is |
|---|---|---|
| `COGNITO_*` (4 values) | `.env` | Your user pool, client, region, hosted-UI domain |
| `SESSION_KEY` | `.env` | A secret you generate once: `openssl rand -base64 32` |
| `APP_BASE_PATH`, `PUBLIC_PATHS`, `API_PREFIX` | `.env` | Your routing shape |
| `STACK_NAME` | `.env` | Your deployment's name prefix (resources become `<name>-aws-static-hosting-<role>`) |
| `DOMAIN_NAME`, `CERTIFICATE_ARN`, `API_ORIGIN_DOMAIN` | `.env` | Optional: custom domain, same-origin API |

That's the whole customisation surface for a typical install. The IaC rig you pick
(CloudFormation under `_dev/cloudformation/`, or OpenTofu under `_dev/terraform/`) reads
the same values.

## Bring your own Cognito

The included Cognito stack is a convenience for a from-scratch demo. If you already have a
user pool, skip it: point the four `COGNITO_*` values at your existing pool and a **public
(no-secret) app client with the authorization-code grant enabled**. Nothing else assumes
the bundled pool.

## Deploy

Full step-by-step runbook — provision once, deploy code separately, flip the Cognito
callback — is in [`DEPLOYMENT.md`](./DEPLOYMENT.md). The short version:

```bash
cp .env.example .env            # then fill it in (see table above)
_dev/scripts/provision.sh       # stand up the infra ONCE
_dev/scripts/deploy-code.sh     # roll out the edge-function code (re-run per change)
```

Prerequisites: Node.js 24+, AWS CLI, `jq`, `openssl`. Lambda@Edge lives in `us-east-1`, so
the hosting stack does too.

## Getting patches later

Our fixes land in `src/` and the deploy scripts. To take them:

1. `git fetch upstream && git merge upstream/master` (option B above).
2. `_dev/scripts/deploy-code.sh` — rebuilds the bundles with your `.env` and your Cognito
   JWKS, and rolls out the new Lambda@Edge version + CloudFront Function **without touching
   your stack**.

The provision/deploy split is deliberate: a code patch never requires a stack change, so
staying current is a rebuild-and-roll, not an infrastructure migration.

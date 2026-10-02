#!/usr/bin/env bash
# Builds the edge functions and deploys the hosting stack from dist/hosting.yaml, the copy of
# cloudformation/hosting.yaml that build.mjs writes with the CloudFront Function code embedded.
#
# Lambda@Edge functions must live in us-east-1, so the stack does too, whatever region your
# Cognito pool is in. Each deploy publishes a new auth-routes version: the build generates a fresh
# sign-in state key every time, so its code hash always changes. The CloudFront Function updates
# within minutes; allow 5-15 minutes for the Lambda@Edge replicas.
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and fill it in." >&2
  exit 1
fi
set -a
source .env
set +a
: "${STACK_NAME:?Set STACK_NAME in .env}"
: "${DEPLOY_BUCKET:?Set DEPLOY_BUCKET (an existing us-east-1 bucket) in .env}"

REGION=us-east-1

npm run build

# Lambda loads <name>.mjs from the zip root; the handler setting is <name>.handler.
(cd dist && rm -f auth-routes.zip && zip -qX auth-routes.zip auth-routes.mjs)

code_sha256() {
  openssl dgst -sha256 -binary "$1" | base64
}

aws cloudformation package \
  --region "$REGION" \
  --template-file dist/hosting.yaml \
  --s3-bucket "$DEPLOY_BUCKET" \
  --s3-prefix "$STACK_NAME" \
  --output-template-file dist/hosting.packaged.yaml

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file dist/hosting.packaged.yaml \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    AuthRoutesCodeSha256="$(code_sha256 dist/auth-routes.zip)" \
    DomainName="${DOMAIN_NAME:-}" \
    CertificateArn="${CERTIFICATE_ARN:-}" \
    ApiOriginDomain="${API_ORIGIN_DOMAIN:-}" \
    ApiPrefix="${API_PREFIX:-/api}"

aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" \
  --output table

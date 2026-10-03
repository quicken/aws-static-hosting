#!/usr/bin/env bash
# Provision the hosting stack ONCE: the S3 origin, CloudFront distribution, OAC, IAM role, and
# the two edge-function SHELLS (with bootstrap stubs). This never carries real function code and
# takes no per-deploy parameters, so you run it once and leave it alone — re-running it only
# reconciles infrastructure drift, never a code change.
#
# Code is rolled out separately by deploy-code.sh (build + update-function-code + publish-version
# + repoint the distribution's Lambda@Edge association). That split is the whole point: the stack
# stays untouched between code deploys, which also makes a future Terraform port clean.
#
# Lambda@Edge functions must live in us-east-1, so the stack does too, whatever region the
# Cognito pool is in.
set -euo pipefail
# This script lives in _dev/scripts/; everything it drives (.env, npm build, dist/) is rooted at
# the project root, two levels up. The CloudFormation template lives in _dev/cloudformation/.
cd "$(dirname "$0")/../.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and fill it in." >&2
  exit 1
fi
set -a
source .env
set +a
: "${STACK_NAME:?Set STACK_NAME in .env}"

# Optional AWS profile. Set AWS_PROFILE in .env (or the environment) to target a named profile;
# leave it unset to use the default profile. Expanded into every aws call, empty when unset.
profile_args=()
[[ -n "${AWS_PROFILE:-}" ]] && profile_args=(--profile "$AWS_PROFILE")

REGION=us-east-1

aws cloudformation deploy \
  "${profile_args[@]}" \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file _dev/cloudformation/hosting.yaml \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    DomainName="${DOMAIN_NAME:-}" \
    CertificateArn="${CERTIFICATE_ARN:-}" \
    ApiOriginDomain="${API_ORIGIN_DOMAIN:-}" \
    ApiPrefix="${API_PREFIX:-/api}"

echo
echo "Stack provisioned. Outputs:"
aws cloudformation describe-stacks \
  "${profile_args[@]}" \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" \
  --output table

echo
echo "Next: run _dev/scripts/deploy-code.sh to build and roll out the real function code."
echo "The /_auth/* path returns 403 until that first code deploy — expected."

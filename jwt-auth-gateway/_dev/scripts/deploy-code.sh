#!/usr/bin/env bash
# Roll out NEW function code to an already-provisioned stack (see provision.sh). Touches no
# CloudFormation: it builds the bundles and drives the AWS API directly, so the provisioning
# stack stays untouched between deploys. Safe to run repeatedly.
#
# Steps:
#   1. npm run build                        -> dist/check-auth.cf.js, dist/auth-routes.mjs
#   2. CloudFront Function (gate):          update-function-code + publish-function (stable ARN)
#   3. Lambda@Edge (auth-routes):           update-function-code + wait + publish-version
#   4. Distribution:                        repoint /_auth/* viewer-request to the new version ARN
#
# Lambda@Edge replicas take 5-15 min to propagate after the distribution deploys; the CloudFront
# Function is live within minutes. Both are normal.
set -euo pipefail
# This script lives in _dev/scripts/; everything it drives (.env, npm build, dist/) is rooted at
# the project root, two levels up.
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
AUTH_PATH="/_auth/*"

echo "==> Reading stack outputs"
outputs=$(aws cloudformation describe-stacks "${profile_args[@]}" --region "$REGION" --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" --output json)
get_output() { echo "$outputs" | jq -r --arg k "$1" '.[] | select(.OutputKey==$k) | .OutputValue'; }

LAMBDA_NAME=$(get_output AuthRoutesFunctionName)
GATE_NAME=$(get_output CheckAuthFunctionName)
DIST_ID=$(get_output DistributionId)
: "${LAMBDA_NAME:?Stack output AuthRoutesFunctionName missing — provision.sh not run?}"
: "${GATE_NAME:?Stack output CheckAuthFunctionName missing}"
: "${DIST_ID:?Stack output DistributionId missing}"

echo "==> Building bundles"
npm run build

# --- 2. CloudFront Function (gate): update in place, publish ------------------------------------
echo "==> Updating CloudFront Function $GATE_NAME"
gate_etag=$(aws cloudfront describe-function "${profile_args[@]}" --name "$GATE_NAME" --query "ETag" --output text)
aws cloudfront update-function \
  "${profile_args[@]}" \
  --name "$GATE_NAME" \
  --if-match "$gate_etag" \
  --function-config '{"Comment":"Viewer-request login gate and deep-link rewrite.","Runtime":"cloudfront-js-2.0"}' \
  --function-code "fileb://dist/check-auth.cf.js" >/dev/null
# describe-function returns a fresh ETag after the update; use it to publish.
gate_etag=$(aws cloudfront describe-function "${profile_args[@]}" --name "$GATE_NAME" --query "ETag" --output text)
aws cloudfront publish-function "${profile_args[@]}" --name "$GATE_NAME" --if-match "$gate_etag" >/dev/null
echo "    gate published"

# --- 3. Lambda@Edge (auth-routes): update code, publish version ---------------------------------
echo "==> Updating Lambda@Edge $LAMBDA_NAME"
(cd dist && rm -f auth-routes.zip && zip -qX auth-routes.zip auth-routes.mjs)
aws lambda update-function-code "${profile_args[@]}" --region "$REGION" \
  --function-name "$LAMBDA_NAME" \
  --zip-file "fileb://dist/auth-routes.zip" >/dev/null
aws lambda wait function-updated "${profile_args[@]}" --region "$REGION" --function-name "$LAMBDA_NAME"
NEW_VERSION_ARN=$(aws lambda publish-version "${profile_args[@]}" --region "$REGION" \
  --function-name "$LAMBDA_NAME" \
  --query "FunctionArn" --output text)
echo "    published $NEW_VERSION_ARN"

# --- 4. Repoint the distribution's /_auth/* association to the new version ARN ------------------
echo "==> Repointing $AUTH_PATH on distribution $DIST_ID"
cfg=$(aws cloudfront get-distribution-config "${profile_args[@]}" --id "$DIST_ID" --output json)
dist_etag=$(echo "$cfg" | jq -r '.ETag')

current_arn=$(echo "$cfg" | jq -r --arg p "$AUTH_PATH" '
  .DistributionConfig.CacheBehaviors.Items[]? | select(.PathPattern==$p)
  | .LambdaFunctionAssociations.Items[]? | select(.EventType=="viewer-request") | .LambdaFunctionARN')

if [[ "$current_arn" == "$NEW_VERSION_ARN" ]]; then
  echo "    already pointing at $NEW_VERSION_ARN — no distribution change"
else
  # Rebuild DistributionConfig: set the viewer-request Lambda association on the /_auth/* behaviour
  # to the new version. update-distribution REPLACES config wholesale, so send the full body with
  # only this behaviour's association changed.
  new_config=$(echo "$cfg" | jq --arg p "$AUTH_PATH" --arg arn "$NEW_VERSION_ARN" '
    .DistributionConfig
    | (.CacheBehaviors.Items) |= map(
        if .PathPattern == $p then
          .LambdaFunctionAssociations = {
            "Quantity": 1,
            "Items": [ { "LambdaFunctionARN": $arn, "EventType": "viewer-request", "IncludeBody": false } ]
          }
        else . end)')
  echo "$new_config" > dist/.dist-config.json
  aws cloudfront update-distribution \
    "${profile_args[@]}" \
    --id "$DIST_ID" \
    --if-match "$dist_etag" \
    --distribution-config "file://dist/.dist-config.json" >/dev/null
  rm -f dist/.dist-config.json
  echo "    repointed $AUTH_PATH -> $NEW_VERSION_ARN"
fi

echo
echo "Done. CloudFront Function is live in minutes; Lambda@Edge replicas take 5-15 min."

#!/usr/bin/env bash
# Tears the demo down. Keeps the user pool (and its users) unless you pass --all.
#
#   ./down.sh          # hosting only
#   ./down.sh --all    # hosting, then the user pool and the SSM secrets
set -euo pipefail
cd "$(dirname "$0")"
source ./env.sh

COGNITO_REGION="${COGNITO_REGION:-ap-southeast-2}"

# Destroy reads variables but uses none that matter; placeholders keep it from prompting. The
# hosting config also reads dist/, so an empty stand-in is enough if it's been cleaned.
mkdir -p ../dist
[[ -f ../dist/auth-routes.mjs ]] || : >../dist/auth-routes.mjs
[[ -f ../dist/check-auth.cf.js ]] || : >../dist/check-auth.cf.js

function_name="$(tf hosting output -raw auth_routes_function 2>/dev/null || true)"

echo "==> Hosting"
tf hosting init -input=false >/dev/null
tf hosting destroy -input=false -auto-approve -var "name=$NAME"

if [[ "${1:-}" == "--all" ]]; then
  echo "==> User pool"
  tf cognito init -input=false >/dev/null
  tf cognito destroy -input=false -auto-approve -var "name=$NAME" -var "region=$COGNITO_REGION"
  aws ssm delete-parameters --region "$SSM_REGION" \
    --names "/$NAME/session-key" "/$NAME/state-passphrase" >/dev/null
  # Both states are empty now, and unreadable without the passphrase just deleted.
  rm -f cognito/terraform.tfstate* hosting/terraform.tfstate*
  echo "Deleted the SSM secrets and the state files."
fi

if [[ -n "$function_name" ]]; then
  cat <<EOF

Destroy left the Lambda@Edge function behind: CloudFront keeps replicas of it for a few hours
after the distribution goes, and Lambda won't delete it until they're gone. Later, run:

  aws lambda delete-function --region us-east-1 --function-name $function_name

Its log groups are spread across the regions it ran in (/aws/lambda/us-east-1.$function_name).
EOF
fi

#!/usr/bin/env bash
# Spins up the whole demo: user pool, build, hosting, and optionally a site and a demo user.
# Safe to rerun; it converges on whatever is already there.
#
#   ./up.sh
#   DEMO_EMAIL=you@example.com ./up.sh                       # also create a user to sign in with
#   SITE_DIR=path/to/dist ./up.sh                            # also upload a built site
#   DOMAIN_NAME=apps.example.com CERTIFICATE_ARN=arn:... ./up.sh
#
# Other settings: NAME (default trailhead-demo), COGNITO_REGION (default ap-southeast-2), and
# the build's own APP_BASE_PATH, PUBLIC_PATHS, API_ORIGIN_DOMAIN and API_PREFIX (see .env.example).
set -euo pipefail
cd "$(dirname "$0")"
source ./env.sh

COGNITO_REGION="${COGNITO_REGION:-ap-southeast-2}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
API_PREFIX="${API_PREFIX:-/api}"

cognito_vars=(-var "name=$NAME" -var "region=$COGNITO_REGION")
hosting_vars=(
  -var "name=$NAME"
  -var "domain_name=$DOMAIN_NAME"
  -var "certificate_arn=${CERTIFICATE_ARN:-}"
  -var "api_origin_domain=${API_ORIGIN_DOMAIN:-}"
  -var "api_prefix=$API_PREFIX"
  -var "cache_enabled=${CACHE_ENABLED:-true}"
)

tf cognito init -input=false >/dev/null
tf hosting init -input=false >/dev/null

# The client's callback URL needs the site host, which a CloudFront domain only has once the
# distribution exists. With a custom domain, or on a rerun, it's known up front and one pass does.
site_host="$DOMAIN_NAME"
if [[ -z "$site_host" ]]; then
  site_host="$(tf hosting output -raw site_host 2>/dev/null || true)"
fi

echo "==> User pool ($COGNITO_REGION)"
tf cognito apply -input=false -auto-approve "${cognito_vars[@]}" -var "site_host=$site_host"

echo "==> Build"
export COGNITO_REGION
COGNITO_USER_POOL_ID="$(tf cognito output -raw user_pool_id)"
COGNITO_CLIENT_ID="$(tf cognito output -raw client_id)"
COGNITO_DOMAIN="$(tf cognito output -raw domain)"
export COGNITO_USER_POOL_ID COGNITO_CLIENT_ID COGNITO_DOMAIN API_PREFIX
# Set even when empty, so a .env left over from deploy.sh can't bake in different settings.
export APP_BASE_PATH="${APP_BASE_PATH:-}"
export PUBLIC_PATHS="${PUBLIC_PATHS:-/public}"
export API_ORIGIN_DOMAIN="${API_ORIGIN_DOMAIN:-}"
export SESSION_KEY_PREVIOUS="${SESSION_KEY_PREVIOUS:-}"
[[ -d ../../node_modules ]] || (cd ../.. && npm ci)
(cd ../.. && npm run build)

echo "==> Hosting (us-east-1)"
tf hosting apply -input=false -auto-approve "${hosting_vars[@]}"

actual_host="$(tf hosting output -raw site_host)"
if [[ "$actual_host" != "$site_host" ]]; then
  echo "==> Registering https://$actual_host/_auth/callback on the app client"
  tf cognito apply -input=false -auto-approve "${cognito_vars[@]}" -var "site_host=$actual_host"
fi

if [[ -n "${SITE_DIR:-}" ]]; then
  bucket="$(tf hosting output -raw bucket)"
  echo "==> Uploading $SITE_DIR to s3://$bucket/${SITE_PREFIX:-}"
  # no-cache: CloudFront revalidates with S3 after its 1-second minimum, so a release is live at once.
  aws s3 sync "$SITE_DIR" "s3://$bucket/${SITE_PREFIX:-}" --delete --cache-control no-cache
fi

if [[ -n "${DEMO_EMAIL:-}" ]]; then
  if aws cognito-idp admin-get-user --region "$COGNITO_REGION" \
      --user-pool-id "$COGNITO_USER_POOL_ID" --username "$DEMO_EMAIL" >/dev/null 2>&1; then
    echo "==> $DEMO_EMAIL already exists"
  else
    # Cognito emails the temporary password; the first sign-in asks for a new one.
    echo "==> Creating $DEMO_EMAIL (check that inbox for the temporary password)"
    aws cognito-idp admin-create-user --region "$COGNITO_REGION" \
      --user-pool-id "$COGNITO_USER_POOL_ID" --username "$DEMO_EMAIL" \
      --user-attributes Name=email,Value="$DEMO_EMAIL" Name=email_verified,Value=true >/dev/null
  fi
fi

echo
echo "Site: $(tf hosting output -raw site_url)"
echo "The CloudFront Function is live within minutes; allow 5-15 for the Lambda@Edge replicas."

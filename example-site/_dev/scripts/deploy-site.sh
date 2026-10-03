#!/usr/bin/env bash
# Upload the example site in src/ to an S3 bucket, for testing any of the hosting approaches in
# this repo (general hosting, basic-auth, the jwt-auth-gateway SPA scenario).
#
# Usage:
#   _dev/scripts/deploy-site.sh <bucket>
#   _dev/scripts/deploy-site.sh <bucket> us-east-1
#   AWS_PROFILE=myprofile _dev/scripts/deploy-site.sh <bucket>
#
# The site root maps to the BUCKET ROOT (the landing page sits at /, apps under /app/), so the
# CONTENTS of src/ sync to s3://<bucket>/. no-cache lets a re-upload go live at once; CloudFront
# still revalidates with S3 after its minimum TTL.
set -euo pipefail
# This script lives in example-site/_dev/scripts/; src/ is two levels up (example-site/src/).
cd "$(dirname "$0")/../.."

BUCKET="${1:?Usage: deploy-site.sh <bucket> [region]}"
REGION="${2:-${AWS_REGION:-}}"

profile_args=()
[[ -n "${AWS_PROFILE:-}" ]] && profile_args=(--profile "$AWS_PROFILE")
region_args=()
[[ -n "$REGION" ]] && region_args=(--region "$REGION")

echo "==> Syncing src/ to s3://$BUCKET/"
aws s3 sync src/ "s3://$BUCKET/" \
  "${profile_args[@]}" "${region_args[@]}" \
  --delete --cache-control no-cache

echo
echo "Done. Test paths (through CloudFront, not the bucket URL):"
echo "  /                     general hosting / public landing"
echo "  /public/              public path, no login"
echo "  /app                  basic auth — the gate"
echo "  /app/dashboard        SPA; deep links under it resolve to its index.html"

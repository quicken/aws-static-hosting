#!/bin/bash

# AWS S3 Deployment Script for Auth Service
set -e

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
else
    echo "Error: .env.local file not found"
    exit 1
fi

# Check required AWS deployment variables
if [ -z "$AWS_S3_BUCKET" ] || [ -z "$AWS_CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "Error: AWS_S3_BUCKET and AWS_CLOUDFRONT_DISTRIBUTION_ID must be set in .env.local"
    echo "Add these lines to your .env.local:"
    echo "AWS_S3_BUCKET=your-bucket-name"
    echo "AWS_CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id"
    echo "AWS_PROFILE=your-profile-name (optional)"
    exit 1
fi

# Set AWS profile if specified
PROFILE_FLAG=""
if [ -n "$AWS_PROFILE" ]; then
    PROFILE_FLAG="--profile $AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

echo "Building auth service..."
npm run build

echo "Deploying auth service to S3 bucket: $AWS_S3_BUCKET/auth/"
aws s3 sync dist/ s3://$AWS_S3_BUCKET/auth/ --delete $PROFILE_FLAG

echo "Invalidating CloudFront distribution: $AWS_CLOUDFRONT_DISTRIBUTION_ID"
aws cloudfront create-invalidation --distribution-id $AWS_CLOUDFRONT_DISTRIBUTION_ID --paths "/auth/*" $PROFILE_FLAG

echo "Auth service deployment complete!"
echo "Auth service should be available at: https://your-domain.com/auth/"

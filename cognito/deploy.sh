#!/bin/bash

# Lambda@Edge Deployment Script
set -e

# Configuration
REGION="us-east-1"  # Lambda@Edge must be deployed to us-east-1

# Load environment variables if available
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Set function name with fallback
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-react-hosting-lambda}"

# Check required variables
if [ -z "$COGNITO_USER_POOL_ID" ] || [ -z "$COGNITO_CLIENT_ID" ]; then
    echo "Error: COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set"
    echo "Set them in .env.production or as environment variables"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="ap-southeast-2"
    echo "Using default AWS_REGION: $AWS_REGION"
fi

# Set AWS profile if specified
PROFILE_FLAG=""
if [ -n "$AWS_PROFILE" ]; then
    PROFILE_FLAG="--profile $AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf bin/

echo "📦 Building Lambda function..."
npm run build

echo "🗜️  Creating deployment package..."
npm run package

# Get the generated zip file
ZIP_FILE=$(ls bin/lambda-react-hosting-*.zip | head -n 1)
if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: Deployment package not found in bin/"
    exit 1
fi

echo "📤 Uploading Lambda function: $ZIP_FILE"
aws lambda update-function-code \
    --region $REGION \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://$ZIP_FILE \
    --no-cli-pager \
    $PROFILE_FLAG

echo "📋 Publishing new version..."
VERSION_OUTPUT=$(aws lambda publish-version \
    --region $REGION \
    --function-name $FUNCTION_NAME \
    --description "Deployed $(date '+%Y-%m-%d %H:%M:%S')" \
    --no-cli-pager \
    $PROFILE_FLAG)

# Extract version number and ARN
VERSION_NUMBER=$(echo $VERSION_OUTPUT | jq -r '.Version')
VERSION_ARN=$(echo $VERSION_OUTPUT | jq -r '.FunctionArn')

echo "✅ Published version: $VERSION_NUMBER"
echo "📍 Version ARN: $VERSION_ARN"

# Check if CloudFront distribution ID is provided
if [ -n "$AWS_CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "🌐 Updating CloudFront distribution: $AWS_CLOUDFRONT_DISTRIBUTION_ID"
    
    # Get current distribution config
    echo "📥 Getting current distribution configuration..."
    DIST_CONFIG=$(aws cloudfront get-distribution-config \
        --id $AWS_CLOUDFRONT_DISTRIBUTION_ID \
        --no-cli-pager \
        $PROFILE_FLAG)
    
    ETAG=$(echo $DIST_CONFIG | jq -r '.ETag')
    
    # Update Lambda@Edge association in the config
    echo "🔧 Updating Lambda@Edge association..."
    UPDATED_CONFIG=$(echo $DIST_CONFIG | jq -r --arg arn "$VERSION_ARN" '
        .DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items[0].LambdaFunctionARN = $arn
    ')
    
    # Save updated config to temporary file
    echo "$UPDATED_CONFIG" | jq -r '.DistributionConfig' > /tmp/distribution-config.json
    
    # Update the distribution
    aws cloudfront update-distribution \
        --id $AWS_CLOUDFRONT_DISTRIBUTION_ID \
        --distribution-config file:///tmp/distribution-config.json \
        --if-match $ETAG \
        --no-cli-pager \
        $PROFILE_FLAG
    
    # Clean up
    rm -f /tmp/distribution-config.json
    
    echo "🚀 CloudFront distribution updated successfully!"
    echo "⏳ Changes will propagate globally in 15-20 minutes"
else
    echo "⚠️  AWS_CLOUDFRONT_DISTRIBUTION_ID not set - skipping CloudFront update"
    echo "📝 Manual step required: Update CloudFront behavior to use:"
    echo "   $VERSION_ARN"
fi

echo ""
echo "🎉 Deployment complete!"
echo "📊 Summary:"
echo "   Function: $FUNCTION_NAME"
echo "   Version: $VERSION_NUMBER"
echo "   Region: $REGION"
echo "   ARN: $VERSION_ARN"

if [ -n "$AWS_CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "   CloudFront: Updated (propagating...)"
else
    echo "   CloudFront: Manual update required"
fi

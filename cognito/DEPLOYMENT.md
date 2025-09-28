# Lambda@Edge Deployment Guide

## Quick Deployment

### 1. Setup Environment
```bash
# Copy example environment file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

### 2. Deploy
```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Deploy Lambda@Edge function
./deploy.sh
```

## What the Deployment Script Does

### 🧹 **Clean & Build**
1. Removes previous `dist/` and `bin/` folders
2. Runs `npm run build` to compile TypeScript
3. Runs `npm run package` to create deployment zip

### 📤 **Upload to Lambda**
1. Updates Lambda function code with new zip file
2. Updates environment variables (Cognito config)
3. Publishes new version with timestamp

### 🌐 **Update CloudFront** (Optional)
1. Gets current CloudFront distribution configuration
2. Updates Lambda@Edge association to new version
3. Applies changes (15-20 minute propagation)

## Environment Variables

### Required
```bash
COGNITO_USER_POOL_ID=ap-southeast-2_TcIZRUVgi
COGNITO_CLIENT_ID=4vlsc2pt7n5lrrvca62gg60ra4
AWS_REGION=ap-southeast-2
```

### Optional
```bash
AWS_CLOUDFRONT_DISTRIBUTION_ID=E2PGT191GRAEIK  # Auto-updates CloudFront
AWS_PROFILE=your-profile                        # AWS CLI profile
```

## Manual CloudFront Update

If `AWS_CLOUDFRONT_DISTRIBUTION_ID` is not set, manually update:

1. **AWS Console** → CloudFront → Your Distribution
2. **Behaviors** → Edit Default Behavior
3. **Lambda Function Associations**
4. **Update ARN** to the new version (shown in deploy output)
5. **Save** and wait for propagation

## Deployment Output

```bash
🎉 Deployment complete!
📊 Summary:
   Function: react-hosting-lambda
   Version: 42
   Region: us-east-1
   ARN: arn:aws:lambda:us-east-1:123456789:function:react-hosting-lambda:42
   CloudFront: Updated (propagating...)
```

## Prerequisites

### AWS CLI Setup
```bash
# Install AWS CLI
pip install awscli

# Configure credentials
aws configure --profile your-profile
```

### Required Permissions
Your AWS user/role needs:
- `lambda:UpdateFunctionCode`
- `lambda:UpdateFunctionConfiguration`
- `lambda:PublishVersion`
- `cloudfront:GetDistributionConfig`
- `cloudfront:UpdateDistribution`

### Node.js Dependencies
```bash
# Install dependencies
npm install

# Verify build scripts work
npm run build
npm run package
```

## Troubleshooting

### **Function Not Found**
```bash
# Create function first (one-time setup)
aws lambda create-function \
  --region us-east-1 \
  --function-name react-hosting-lambda \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://bin/lambda-react-hosting-1.0.0.zip
```

### **CloudFront Update Fails**
- Check `AWS_CLOUDFRONT_DISTRIBUTION_ID` is correct
- Ensure you have CloudFront permissions
- Verify distribution exists and is not already updating

### **Environment Variables Missing**
```bash
# Check .env.local exists and has required variables
cat .env.local

# Or set directly
export COGNITO_USER_POOL_ID=your-pool-id
export COGNITO_CLIENT_ID=your-client-id
```

## Production Deployment

### Staging
```bash
# Use staging environment
cp .env.staging .env.local
./deploy.sh
```

### Production
```bash
# Use production environment
cp .env.production .env.local
./deploy.sh
```

The deployment script handles the complete Lambda@Edge deployment lifecycle automatically.

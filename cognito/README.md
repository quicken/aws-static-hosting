# Cognito-Protected React Hosting Lambda@Edge

Lambda@Edge function that serves multiple React applications with AWS Cognito authentication. Provides public access to login flows while protecting all other content behind JWT validation.

## What This Lambda Function Does

This Lambda@Edge function acts as a **pure authorization gateway** for Cognito-protected React applications. It performs authentication checks and lets CloudFront handle all content delivery.

### Authorization Strategy

**Lambda@Edge Role:**
- Validates JWT tokens from Cognito for protected routes
- Returns authorization decisions (allow/redirect)
- No content serving - purely authentication logic

**CloudFront Role:**
- Serves HTML files directly from S3 origin after Lambda authorization
- Handles all caching at the CDN level for optimal performance
- Routes to appropriate S3 files based on path structure

### Public vs Protected Route Authorization

**Public Routes** (`/public/*`):
- **No Authentication Required**: Lambda returns 200 (allow)
- **Login Application**: Contains the OAuth/PKCE login flow
- **CloudFront Serves**: `public/index.html` from S3
- **Examples**: `/public/login`, `/public/oauth/callback`

**Protected Routes** (everything else):
- **Authentication Required**: Lambda validates JWT token in `cognito-token` cookie
- **Valid Token**: Lambda returns 200 (allow), CloudFront serves `index.html`
- **Invalid/Missing Token**: Lambda returns 302 redirect to `/public/login`
- **Examples**: `/`, `/dashboard`, `/users/123`

### Authentication Flow

1. **Unauthenticated User** visits `/dashboard`
2. **Lambda@Edge**: No valid JWT token found
3. **Redirect**: Lambda returns 302 redirect to `/public/login`
4. **Login Process**: User authenticates via Cognito OAuth + PKCE
5. **Token Set**: Login app sets `cognito-token` cookie with JWT
6. **Access Granted**: Lambda authorizes, CloudFront serves protected content

### Request Flow

- **Authorization Check**: Lambda@Edge validates authentication
- **Content Delivery**: CloudFront serves files from S3 origin
- **Caching**: CloudFront handles all caching (no Lambda memory usage)
- **Performance**: Optimal CDN performance with security enforcement

This approach provides secure, scalable authorization while leveraging CloudFront's superior content delivery and caching capabilities.

## Routing Logic

The Lambda@Edge function uses a **smart routing decision process** that distinguishes between direct file requests and SPA routes:

### Step 1: Route Type Detection

**SPA Route Detection** (`isSpaRoute`):
- **SPA Routes**: Paths without file extensions (e.g., `/`, `/dashboard`, `/users/123`)
- **Asset Routes**: Paths with file extensions (e.g., `/assets/main.js`, `/favicon.ico`)
- **Logic**: `!pathname.match(/\.[a-zA-Z0-9]+$/)`

### Step 2: Authorization Classification

**Public Path Detection** (`isPublicPath`):
- **Public Paths**: `/`, `/index.html`, and routes starting with `/public` (no authentication required)
- **Protected Paths**: All other SPA routes (authentication required)
- **Logic**: `pathname === '/' || pathname === '/index.html' || pathname.startsWith('/public')`

### Step 3: Smart URI Handling

**Direct File Requests** (pass through to S3):
- `/index.html` → No rewrite, served directly from S3
- `/public/index.html` → No rewrite, served directly from S3

**SPA Routes** (rewrite for React Router):
- `/` → Rewrite to `/index.html`
- `/dashboard` → Rewrite to `/index.html` (after auth check)
- `/public/login` → Rewrite to `/public/index.html`

### Complete Routing Flow

```
Request Path
    ↓
Is SPA Route? (no file extension)
    ↓ No → Return 404 Not Found
    ↓ Yes
Is Public Path? (/, /index.html, /public/*)
    ↓ Yes → Continue (no auth required)
    ↓ No (Protected Path)
Has Valid JWT Token?
    ↓ No → Return 302 Redirect to /public/login
    ↓ Yes → Continue (authenticated)
Is Direct File Request? (/index.html, /public/index.html)
    ↓ Yes → Pass through to S3 (no rewrite)
    ↓ No → Rewrite URI for SPA routing
CloudFront serves file from S3
```

### Route Examples

| Path | Type | Access | URI Rewrite | Result |
|------|------|--------|-------------|--------|
| `/` | SPA | Public | `/index.html` | Main app |
| `/dashboard` | SPA | Protected | `/index.html` | Main app (auth required) |
| `/index.html` | SPA | Public | No rewrite | Direct file serve |
| `/public/login` | SPA | Public | `/public/index.html` | Login app |
| `/public/index.html` | SPA | Public | No rewrite | Direct file serve |
| `/assets/main.js` | Asset | N/A | N/A | 404 Not Found |

This approach ensures:
- **No false 404s** in CloudFront logs
- **Direct file access** works normally
- **SPA routing** functions correctly
- **Authentication** is enforced where needed

## Problem Statement

This Lambda@Edge function solves the challenge of hosting multiple React applications with centralized authentication using AWS Cognito.

**The Challenge:**
- Need to host multiple React applications with shared authentication
- Require public access to login/OAuth flows while protecting all other content
- Must support OAuth 2.0 Authorization Code + PKCE flow with Cognito
- Need proper SPA routing for both public and protected applications

**The Solution:**
The Lambda@Edge acts as an authentication gateway that:
1. **Public Access**: Serves login application and OAuth endpoints without authentication
2. **Protected Content**: Validates JWT tokens from Cognito for all protected routes
3. **OAuth Flow**: Handles Authorization Code + PKCE flow with Cognito
4. **SPA Routing**: Supports React Router for both public and protected applications
5. **JWT Validation**: Verifies Cognito JWT tokens and manages authentication state

This approach provides centralized authentication for multiple React applications while maintaining proper security boundaries and SPA functionality.

## Features

- **Cognito Authentication**: Cryptographic JWT signature verification with JWKS
- **Public Access**: Unrestricted access to login application and OAuth flows
- **OAuth 2.0 + PKCE**: Full support for Authorization Code + PKCE flow
- **Pure Authorization**: Lambda only handles auth - CloudFront serves content
- **CloudFront Integration**: Optimal caching and performance via CDN
- **Directory-Based Security**: Public folder for unrestricted access, everything else protected
- **Modern React Support**: Optimized for bundled React applications
- **Security Best Practices**: Proper JWT validation with audience claims and token type verification

## Architecture

```
src/
├── index.ts           # Main Lambda handler
└── lib/
    ├── routing.ts     # URL routing utilities (SPA route detection)
    └── auth.ts        # Cognito JWT validation and authentication
```

## Environment Variables

- `COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID for JWT validation (required)
- `COGNITO_CLIENT_ID`: AWS Cognito App Client ID (required)
- `AWS_REGION`: AWS region (defaults to ap-southeast-2)

## How It Works

### Public Routes (No Authentication Required)
- **Root path** (`/`): Rewrites to `/index.html` - serves main application without authentication
- **Direct file** (`/index.html`): Passes through to S3 - serves main application directly
- **Public folder** (`/public/*`): SPA routes rewrite to `/public/index.html`, direct files pass through
- Lambda returns 200 (authorized) - CloudFront serves the appropriate HTML file
- No JWT validation required

### Protected Routes (Authentication Required)
- **Protected SPA routes** (`/dashboard`, `/users/123`):
- Lambda validates JWT token from `cognito-token` cookie
- On valid token: Rewrites to `/index.html` - CloudFront serves main app
- On invalid/missing token: Returns 302 redirect to `/public/login`

### Asset Handling
- **Asset Requests** (`/assets/main.js`, `/favicon.ico`):
- Returns 404 Not Found
- Encourages proper asset bundling or CDN usage

## S3 Structure

Your S3 bucket should contain:
```
bucket-name/
├── index.html          # Main HTML file
└── public/
    └── index.html      # Login application HTML
```

## Deployment

### Complete Deployment Workflow

Follow these steps to deploy the Lambda@Edge function and attach it to CloudFront:

#### Step 1: Create Deployment Package

1. Build and package the Lambda function:
   ```bash
   npm run package
   ```

2. The deployment zip file is created at:
   ```
   bin/lambda-react-hosting-{version}.zip
   ```
   For example: `bin/lambda-react-hosting-1.0.0.zip`

#### Step 2: Deploy to Lambda (us-east-1 required)

Deploy the zip file to Lambda in **us-east-1** region (required for Lambda@Edge):

```bash
aws lambda create-function \
  --region us-east-1 \
  --function-name react-hosting-lambda \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler handler.handler \
  --zip-file fileb://bin/lambda-react-hosting-1.0.0.zip \
  --environment Variables='{COGNITO_USER_POOL_ID=your-user-pool-id,COGNITO_CLIENT_ID=your-client-id,AWS_REGION=ap-southeast-2}'
```

#### Step 3: Publish Lambda Version

```bash
aws lambda publish-version \
  --region us-east-1 \
  --function-name react-hosting-lambda \
  --description "Production version for Lambda@Edge"
```

Note the returned version ARN: `arn:aws:lambda:us-east-1:ACCOUNT:function:react-hosting-lambda:1`

#### Step 4: Attach to CloudFront

Add the Lambda@Edge function to your CloudFront distribution's default behavior:

**AWS Console:**
1. Navigate to CloudFront Console
2. Select your distribution → Edit default behavior  
3. Add Lambda Function Association:
   - **Event Type**: Viewer Request
   - **Function ARN**: `arn:aws:lambda:us-east-1:ACCOUNT:function:react-hosting-lambda:1`
4. Save changes (takes 15-20 minutes to deploy)

### AWS Lambda Deployment

1. **Create Lambda Function** (AWS CLI):
   ```bash
   aws lambda create-function \
     --function-name react-hosting-lambda \
     --runtime nodejs20.x \
     --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
     --handler index.handler \
     --zip-file fileb://bin/lambda-react-hosting-1.0.0.zip \
     --environment Variables='{COGNITO_USER_POOL_ID=your-user-pool-id,COGNITO_CLIENT_ID=your-client-id,AWS_REGION=ap-southeast-2}'
   ```

2. **Update Existing Function** (AWS CLI):
   ```bash
   aws lambda update-function-code \
     --function-name react-hosting-lambda \
     --zip-file fileb://bin/lambda-react-hosting-1.0.0.zip
   ```

3. **AWS Console Deployment**:
   - Navigate to AWS Lambda console
   - Select your function or create new one
   - Upload the zip file from `bin/lambda-react-hosting-{version}.zip`
   - Set handler to `index.handler`
   - Configure environment variables

### Lambda Configuration

- **Runtime**: Node.js 20.x
- **Handler**: `index.handler`
- **Memory**: 128-256 MB (depending on app size)
- **Timeout**: 30 seconds
- **IAM Role**: Must have S3 read permissions for the bucket

### Required IAM Permissions

The Lambda function only needs basic execution permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## CloudFront Integration

### Attaching Lambda@Edge to CloudFront

After deploying your Lambda function, attach it to CloudFront as a Lambda@Edge function:

#### 1. Publish Lambda Version

Lambda@Edge requires a published version (not $LATEST):

```bash
aws lambda publish-version \
  --function-name react-hosting-lambda \
  --description "Production version for Lambda@Edge"
```

Note the returned version ARN (e.g., `arn:aws:lambda:us-east-1:123456789012:function:react-hosting-lambda:1`)

#### 2. Create CloudFront Distribution

Create a CloudFront distribution with your S3 bucket as origin:

```bash
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "react-hosting-'$(date +%s)'",
    "Comment": "React hosting with Cognito auth",
    "DefaultRootObject": "index.html",
    "Origins": {
      "Quantity": 1,
      "Items": [{
        "Id": "S3-react-bucket",
        "DomainName": "your-bucket-name.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }]
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-react-bucket",
      "ViewerProtocolPolicy": "redirect-to-https",
      "TrustedSigners": {
        "Enabled": false,
        "Quantity": 0
      },
      "ForwardedValues": {
        "QueryString": false,
        "Cookies": {"Forward": "all"}
      },
      "LambdaFunctionAssociations": {
        "Quantity": 1,
        "Items": [{
          "LambdaFunctionARN": "arn:aws:lambda:us-east-1:123456789012:function:react-hosting-lambda:1",
          "EventType": "viewer-request"
        }]
      }
    },
    "Enabled": true
  }'
```

#### 3. Update Existing Distribution (AWS Console)

1. **Navigate to CloudFront Console**
2. **Select your distribution** → Edit
3. **Go to Behaviors tab** → Edit default behavior
4. **Scroll to Lambda Function Associations**
5. **Add association**:
   - **CloudFront Event**: Viewer Request
   - **Lambda Function ARN**: `arn:aws:lambda:us-east-1:ACCOUNT:function:react-hosting-lambda:VERSION`
   - **Include Body**: No
6. **Save changes**

#### 4. Update Existing Distribution (AWS CLI)

```bash
# Get current distribution config
aws cloudfront get-distribution-config --id YOUR_DISTRIBUTION_ID > dist-config.json

# Edit the JSON to add Lambda@Edge association under DefaultCacheBehavior:
# "LambdaFunctionAssociations": {
#   "Quantity": 1,
#   "Items": [{
#     "LambdaFunctionARN": "arn:aws:lambda:us-east-1:ACCOUNT:function:react-hosting-lambda:VERSION",
#     "EventType": "viewer-request"
#   }]
# }

# Update distribution
aws cloudfront update-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --distribution-config file://dist-config.json \
  --if-match ETAG_FROM_GET_COMMAND
```

### Important Notes

- **Lambda@Edge Region**: Deploy Lambda function to **us-east-1** (required for Lambda@Edge)
- **Published Version**: Must use published version ARN, not $LATEST
- **Propagation Time**: CloudFront changes take 15-20 minutes to deploy globally
- **Cookie Forwarding**: Ensure CloudFront forwards cookies (required for JWT tokens)
- **Viewer Request**: Use "viewer-request" event type for authorization checks

## Cognito Setup

### User Pool Configuration

1. **Create Cognito User Pool** with the following settings:
   - Sign-in options: Email
   - Password policy: As per your requirements
   - MFA: Optional based on security needs

2. **App Client Configuration**:
   - App type: Public client
   - Authentication flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
   - OAuth 2.0 flows: Authorization code grant
   - OAuth scopes: `openid`, `email`, `profile`
   - Callback URLs: Your application domains
   - Sign out URLs: Your application domains

### Required Environment Variables

Set these in your Lambda function:
- `COGNITO_USER_POOL_ID`: From User Pool settings
- `COGNITO_CLIENT_ID`: From App Client settings
- `AWS_REGION`: Region where User Pool is deployed

### Login Application Integration

Your login application in the `/public` folder should:
1. Implement OAuth 2.0 Authorization Code + PKCE flow
2. Set JWT token in `cognito-token` cookie upon successful authentication
3. Handle token refresh and logout flows
4. Redirect to protected routes after authentication

## Testing

Unit tests cover:
- Routing utilities (SPA route detection, public path checking)
- Authentication utilities (JWT token extraction)
- Handler logic (authorization decisions and redirects)

Run tests with `npm test` for watch mode or `npm run test:run` for single execution.

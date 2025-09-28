# AWS Cognito Headless Authentication Service

A React 19 + TypeScript + Vite headless authentication service for securing multiple applications within a CloudFront distribution using AWS Cognito and Lambda@Edge.

## Architecture Overview

This service is designed to work as a centralized authentication handler in a multi-application CloudFront distribution where:

- **Lambda@Edge** protects private routes by checking for valid JWT cookies
- **Multiple Vite apps** sit behind the same CloudFront distribution
- **Headless auth service** handles OAuth flows and sets secure JWT cookies
- **Cognito Hosted UI** provides the actual login interface

## Intended Flow

```
User requests /app1/dashboard
    ↓
Lambda@Edge checks JWT cookie
    ↓
Invalid/missing JWT → Redirect to /auth/?return_url=/app1/dashboard
    ↓
Auth service checks authentication status
    ↓
Not authenticated → Redirect to Cognito Hosted UI
    ↓
User authenticates → Cognito redirects to /auth/callback
    ↓
Auth service sets secure JWT cookie → Redirect to return_url
    ↓
Lambda@Edge validates JWT → Allow access to /app1/dashboard
```

## CloudFront Distribution Structure

```
yourdomain.com/
├── /auth/          # This headless auth service
├── /app1/          # Protected Vite application 1
├── /app2/          # Protected Vite application 2
├── /public/        # Public assets (no auth required)
└── /               # Public home page
```

## Operating Modes

### Production Mode (Headless)
**Environment:** `VITE_DEBUG_MODE=false`

- **`/auth/`** - Headless authentication handler
- **`/auth/callback`** - OIDC callback processing
- No debug UI exposed

### Debug Mode (Development)
**Environment:** `VITE_DEBUG_MODE=true`

- **`/auth/`** - Headless authentication handler  
- **`/auth/callback`** - OIDC callback processing
- **`/auth/debug`** - Full authentication test interface

## Key Features

### Headless Operation
- Processes OAuth flows without UI (uses Cognito Hosted UI)
- Sets secure JWT cookies using best practices
- Redirects back to original requested URL
- Minimal footprint for production deployments

### Lambda@Edge Integration
- Designed to work with Lambda@Edge JWT validation
- Handles session renewal and token refresh
- Provides seamless user experience across multiple apps

### Security Best Practices
- HTTP-only secure cookies (when implemented server-side)
- PKCE (Proof Key for Code Exchange) for OAuth
- Automatic token refresh
- Secure logout with Cognito hosted UI

## Configuration

### Environment Variables
```bash
# AWS Cognito Configuration
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_abc123
VITE_COGNITO_CLIENT_ID=abc123def456
VITE_COGNITO_DOMAIN=my-app-auth

# Auth Service Configuration  
VITE_AUTH_BASE_PATH=/auth
VITE_DEBUG_MODE=false
```

### AWS Cognito Setup
1. Create a Cognito User Pool
2. Configure App Client with:
   - Authorization code grant flow
   - PKCE enabled
   - Allowed callback URLs: `https://yourdomain.com/auth/callback`
   - Allowed sign-out URLs: `https://yourdomain.com/auth/`
   - OpenID Connect scopes: `openid`, `email`

## Development

### Prerequisites
- Node.js 18+
- AWS Cognito User Pool configured
- CloudFront distribution (for production)

### Installation
```bash
npm install
```

### Development Server
```bash
npm start          # Runs with debug mode enabled
```

### Production Build
```bash
VITE_DEBUG_MODE=false npm run build
```

## Lambda@Edge Integration

### JWT Validation Logic
Your Lambda@Edge function should:

1. Check for `auth_token` cookie
2. Validate JWT signature and expiration
3. If invalid/missing: redirect to `/auth/?return_url=${originalUrl}`
4. If valid: allow request to proceed

### Example Lambda@Edge Flow
```javascript
exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    
    // Extract JWT from cookie
    const authCookie = extractAuthCookie(headers.cookie);
    
    if (!isValidJWT(authCookie)) {
        // Redirect to auth service
        const response = {
            status: '302',
            headers: {
                location: [{
                    key: 'Location',
                    value: `/auth/?return_url=${encodeURIComponent(request.uri)}`
                }]
            }
        };
        callback(null, response);
    } else {
        // Allow request
        callback(null, request);
    }
};
```

## Deployment

### Build Process
```bash
# Production build (headless mode)
VITE_DEBUG_MODE=false npm run build

# Deploy to S3 bucket mapped to /auth/* in CloudFront
aws s3 sync dist/ s3://your-bucket/auth/ --delete
```

### CloudFront Behaviors
Configure these behaviors in your CloudFront distribution:

- **`/auth/*`** → S3 bucket with this auth service
- **`/app1/*`** → S3 bucket with protected app 1  
- **`/app2/*`** → S3 bucket with protected app 2
- **`/public/*`** → S3 bucket with public assets (no Lambda@Edge)

## Security Considerations

- JWT cookies should be HTTP-only and Secure
- Use Lambda@Edge for server-side JWT validation
- Implement proper CORS headers for cross-origin requests
- Regular token rotation and validation
- Secure logout clears all authentication state

## Use Cases

This architecture is ideal for:
- Multi-tenant SaaS applications
- Microservices with shared authentication
- Static site generators requiring authentication
- Enterprise applications with multiple frontend apps
- Any scenario requiring centralized auth with distributed apps

## Contributing

1. Follow React 19 and TypeScript best practices
2. Test both headless and debug modes
3. Ensure Lambda@Edge compatibility
4. Update documentation for architectural changes

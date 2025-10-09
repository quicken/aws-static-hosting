# JWT Authentication Gateway for CloudFront Static Hosting

> **Enterprise-grade Lambda@Edge authentication solution for securing static web applications with JWT token validation**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![AWS Lambda@Edge](https://img.shields.io/badge/AWS-Lambda%40Edge-orange.svg)](https://aws.amazon.com/lambda/edge/)

## 🚀 Overview

**JWT Authentication Gateway** is a production-ready Lambda@Edge function that transforms AWS CloudFront into a secure hosting platform for multiple single-page applications (SPAs). Built for enterprises requiring cost-effective, scalable authentication without sacrificing performance or security.

### Key Value Propositions

✅ **Zero Infrastructure Overhead** - Serverless authentication at the edge
✅ **Enterprise Security** - Industry-standard JWT validation with cryptographic verification
✅ **Cost Optimisation** - Pay-per-request pricing with CloudFront's global CDN performance
✅ **Multi-Tenant Ready** - Host unlimited SPAs under a single distribution
✅ **Developer Experience** - Seamless integration with modern React applications

## 🎯 Problem Statement

Traditional web application hosting requires complex infrastructure for authentication, load balancing, and content delivery. This solution eliminates the need for:

- Dedicated authentication servers
- Complex reverse proxy configurations
- Expensive always-on infrastructure
- Manual SSL certificate management
- Geographic content distribution setup

## 🏗️ Architecture

```mermaid
graph TD
    A[User Request] --> B[CloudFront Distribution]
    B --> C[Lambda@Edge Function]
    C --> D{JWT Valid?}
    D -->|Yes| E[Serve from S3]
    D -->|No| F[Redirect to Auth]
    F --> G[OAuth2 PKCE Flow]
    G --> H[Set JWT Cookie]
    H --> I[Return to Original URL]
```

## 🔧 Technical Specifications

### JWT Validation Engine

- **Library**: `jsonwebtoken` v9.0.2 - Industry-standard JWT implementation
- **Key Management**: `jwks-client` v2.0.5 - Automatic JWKS endpoint integration
- **Cryptographic Verification**: RS256 signature validation with rotating keys
- **Token Validation**: Audience claims, expiration, and issuer verification

### OAuth2 Integration

- **Flow Type**: Authorization Code with PKCE (Proof Key for Code Exchange)
- **Client Library**: `oidc-client-ts` v3.3.0 (auth-ui companion project)
- **Security Standards**: RFC 7636 compliant PKCE implementation
- **State Management**: Secure return URL preservation via OAuth state parameter

### Performance Characteristics

- **Scalability**: Automatic scaling with CloudFront edge locations
- **Availability**: 99.99% uptime with AWS global infrastructure

## 📦 Features

### 🔐 Security Features

- **JWT Signature Verification** - Cryptographic validation using JWKS
- **PKCE OAuth2 Flow** - Protection against authorization code interception
- **CSRF Protection** - State parameter validation prevents cross-site attacks
- **Secure Cookie Handling** - HTTP-only, secure, SameSite cookie attributes
- **URL Validation** - Prevents open redirect vulnerabilities

### 🌐 Hosting Capabilities

- **Public Content Delivery** - Unrestricted access to `/public/*` routes
- **Protected Application Hosting** - JWT-secured SPA deployment
- **Multi-Application Support** - Unlimited SPAs under configurable base paths
- **SPA Routing Support** - Automatic URL rewriting for client-side routing
- **Static Asset Protection** - Secure JavaScript, CSS, and media files

### ⚡ Performance Optimisations

- **Edge Computing** - Authentication logic runs at CloudFront edge locations
- **Zero Content Serving** - Lambda handles only authentication, CloudFront serves content
- **Intelligent Caching** - CloudFront CDN optimisation with authentication bypass
- **404 Prevention** - Smart URL rewriting eliminates cache miss logging in CloudWatch.

## 🚀 Quick Start

### Prerequisites

- AWS Account with CloudFront and Lambda@Edge permissions
- Node.js 18+ development environment
- AWS Cognito User Pool (or compatible OIDC provider)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/jwt-auth-gateway.git
cd jwt-auth-gateway

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Cognito details
```

### Configuration

Create `.env` file with your AWS Cognito configuration:

```bash
COGNITO_USER_POOL_ID=ap-southeast-2_abc123def
COGNITO_CLIENT_ID=1234567890abcdef
AWS_REGION=ap-southeast-2
SPA_BASE_PATH=apps
```

**Important**: Environment variables are compiled into the Lambda function at build time due to Lambda@Edge limitations.

### Build and Deploy

```bash
# Build the Lambda function
npm run build

# Create deployment package
npm run package

# Deploy to AWS Lambda (us-east-1 required for Lambda@Edge)
aws lambda create-function \
  --region us-east-1 \
  --function-name jwt-auth-gateway \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://bin/lambda-jwt-auth-gateway-1.0.12.zip
```

## 📁 S3 Bucket Structure

Organise your S3 bucket content following this proven structure:

```
your-bucket/
├── auth/                    # OAuth2 authentication service
│   ├── index.html          # OIDC client application
│   ├── static/             # Auth UI assets
│   └── callback/           # OAuth callback handling
├── apps/                   # Protected SPA applications
│   ├── dashboard/          # Business intelligence SPA
│   │   ├── index.html
│   │   └── static/
│   ├── admin/              # Administration SPA
│   │   ├── index.html
│   │   └── static/
│   └── crm/                # Customer relationship SPA
│       ├── index.html
│       └── static/
└── public/                 # Public content (no authentication)
    ├── index.html          # Landing page
    ├── assets/             # Public assets
    └── documentation/      # Public documentation
```

## 🔄 Authentication Flow

### 1. Initial Request

```
User → /apps/dashboard → Lambda@Edge → JWT Validation
```

### 2. Unauthenticated Redirect

```
Lambda@Edge → 302 Redirect → /auth/?return_url=%2Fapps%2Fdashboard
```

### 3. OAuth2 PKCE Flow

```
Auth UI → Cognito Hosted UI → Authorization Code + PKCE → JWT Token
```

### 4. Secure Return

```
Set JWT Cookie → Redirect to Original URL → Lambda@Edge → Access Granted
```

## 🛠️ Integration with Auth UI

This gateway is designed to work seamlessly with the companion **auth-ui** project:

- **Technology Stack**: React 19 + TypeScript + Vite
- **OAuth2 Library**: `oidc-client-ts` v3.3.0
- **Flow Implementation**: Authorization Code with PKCE (RFC 7636)
- **Security Features**: Automatic token refresh, secure logout, state validation

The auth-ui handles the complete OAuth2 flow while this gateway provides the authorization enforcement.

## 📊 Use Cases

### Enterprise Applications

- **Multi-tenant SaaS platforms** with shared authentication
- **Internal company portals** with department-specific applications
- **Customer-facing dashboards** with role-based access control

### Development Teams

- **Microservices frontends** requiring centralized authentication
- **Static site generators** with premium content protection
- **JAMstack applications** needing user authentication

### Cost-Conscious Organizations

- **Startups** requiring enterprise-grade security without infrastructure costs
- **SMBs** needing scalable authentication without DevOps overhead
- **Agencies** managing multiple client applications

## 🔧 Advanced Configuration

### Multi-SPA Routing

Configure multiple applications under a single base path:

```typescript
// Environment configuration
SPA_BASE_PATH = apps;

// Automatic routing resolution:
// /apps/dashboard/users    → /apps/dashboard/index.html
// /apps/admin/settings     → /apps/admin/index.html
// /apps/analytics/reports  → /apps/analytics/index.html
```

### CloudFront Behavior Configuration

```yaml
Behaviors:
  - PathPattern: "/auth/*"
    TargetOrigin: S3Origin
    ViewerProtocolPolicy: redirect-to-https
    LambdaFunctionAssociations:
      - EventType: viewer-request
        LambdaFunctionARN: !Ref JWTAuthGatewayVersion

  - PathPattern: "/apps/*"
    TargetOrigin: S3Origin
    ViewerProtocolPolicy: redirect-to-https
    CachePolicyId: CachingDisabled
    LambdaFunctionAssociations:
      - EventType: viewer-request
        LambdaFunctionARN: !Ref JWTAuthGatewayVersion
```

## 🧪 Testing

Comprehensive test suite covering all authentication scenarios:

```bash
# Run test suite
npm test

# Generate coverage report
npm run test:coverage

# Single test execution
npm run test:run
```

**Test Coverage**:

- JWT token validation scenarios
- URL routing and rewriting logic
- Authentication flow edge cases
- Error handling and security boundaries

## 📈 Performance Metrics

| Metric              | Value     | Notes                          |
| ------------------- | --------- | ------------------------------ |
| Cold Start Latency  | < 100ms   | Typical edge location response |
| Memory Usage        | 128MB     | Recommended Lambda allocation  |
| Concurrent Requests | Unlimited | Auto-scaling with CloudFront   |
| Global Availability | 99.99%    | AWS infrastructure SLA         |

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/your-org/jwt-auth-gateway/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/jwt-auth-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/jwt-auth-gateway/discussions)

---

**Built with ❤️ for the AWS community**

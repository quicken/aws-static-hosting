# OAuth2 Authentication UI for CloudFront Static Hosting

> **Enterprise-grade React authentication client implementing OAuth2 Authorization Code with PKCE flow for AWS Cognito integration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React Version](https://img.shields.io/badge/react-19.1.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-7.1.5-646CFF.svg)](https://vitejs.dev/)

## 🚀 Overview

**OAuth2 Authentication UI** is a POC of a near production-ready React application that provides seamless authentication services for the JWT Authentication Gateway ecosystem. Built as a close to headless authentication service, it handles the complete OAuth2 Authorization Code with PKCE flow while maintaining enterprise security standards.

*As always do your own due diligence before using this application.*

### Key Value Propositions

- ✅ **Generic Architecture** - Authentication handling with automatic redirects
- ✅ **OAuth2 PKCE Compliance** - RFC 7636 compliant implementation for maximum security
- ✅ **Enterprise Integration** - Seamless AWS Cognito and OIDC provider compatibility
- ✅ **Developer Experience** - Modern React 19 with TypeScript and Vite tooling
- ✅ **Near Production Ready** - Comprehensive error handling and security best practices

## 🎯 Problem Statement

Modern web applications require secure, user-friendly authentication that doesn't disrupt the user experience. Traditional authentication solutions often require:

- Complex server-side session management
- Intrusive login pages that break application flow
- Manual token handling and refresh logic
- Custom security implementations prone to vulnerabilities

This solution provides a **mostly headless authentication service** that handles all OAuth2 complexity while maintaining seamless user experience.

## 🔧 Technical Specifications

### OAuth2 Implementation
- **Library**: `oidc-client-ts` v3.3.0 - Industry-standard OpenID Connect client
- **React Integration**: `react-oidc-context` v3.3.0 - React hooks for OIDC
- **Flow Type**: Authorization Code with PKCE (RFC 7636)
- **Security Standards**: OpenID Connect 1.0 compliant

### Frontend Technology Stack
- **Framework**: React 19.1.1 - Latest React with concurrent features
- **Language**: TypeScript 5.9.2 - Type-safe development
- **Build Tool**: Vite 7.1.5 - Lightning-fast development and builds
- **Routing**: React Router DOM 7.8.2 - Client-side routing

### Security Features
- **PKCE Implementation** - Proof Key for Code Exchange prevents authorization code interception
- **State Parameter Validation** - CSRF protection via OAuth2 state parameter
- **Secure Cookie Management** - HTTP-only, secure, SameSite cookie attributes
- **Automatic Token Refresh** - Seamless session management without user intervention
- **Secure Logout** - Complete session termination with provider cleanup

## 📦 Features

### 🔐 Authentication Modes

#### Production Mode (Headless)
```bash
VITE_DEBUG_MODE=false
```
- **Invisible Operation** - No UI, pure authentication logic
- **Automatic Redirects** - Seamless return to original destination
- **Minimal Footprint** - Optimised bundle size for production

#### Debug Mode (Development)
```bash
VITE_DEBUG_MODE=true
```
- **Authentication Dashboard** - Visual token inspection and testing
- **Flow Debugging** - Step-by-step OAuth2 flow visualization
- **Token Management** - Manual token refresh and logout testing

### 🌐 Integration Capabilities
- **AWS Cognito Native** - Optimised for Cognito User Pools and Identity Pools
- **Generic OIDC Support** - Compatible with any OpenID Connect provider
- **Lambda@Edge Ready** - Designed for JWT Authentication Gateway integration
- **Multi-Application Support** - Single auth service for multiple SPAs

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ development environment
- AWS Cognito User Pool configured with OAuth2 settings
- CloudFront distribution with JWT Authentication Gateway deployed

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/oauth2-auth-ui.git
cd oauth2-auth-ui

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Configuration

Create `.env.local` file with your AWS Cognito configuration:

```bash
# AWS Cognito Configuration
VITE_COGNITO_REGION=ap-southeast-2
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_abc123def
VITE_COGNITO_CLIENT_ID=1234567890abcdef
VITE_COGNITO_DOMAIN=your-app-auth

# Authentication Service Configuration
VITE_AUTH_BASE_PATH=/auth
VITE_DEBUG_MODE=false

# Optional: Custom redirect URIs
VITE_REDIRECT_URI=https://yourdomain.com/auth/callback
VITE_POST_LOGOUT_REDIRECT_URI=https://yourdomain.com/auth/
```

### Development

```bash
# Start development server with debug mode
VITE_DEBUG_MODE=true npm start

# Production build (headless mode)
VITE_DEBUG_MODE=false npm run build

# Preview production build
npm run preview
```

## 🔗 Integration with JWT Authentication Gateway

This authentication UI is designed to work seamlessly with the **JWT Authentication Gateway** Lambda@Edge function:

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Built with ❤️ for secure, scalable authentication**

**Watch Full Tutorial: [How to Host your JS App on AWS like a BOSS](https://youtu.be/Pb23xfcLMJc)**
# AWS Cognito Authentication Reference

A React 19 + TypeScript + Vite frontend application demonstrating AWS Cognito authentication flows.

## Overview

This reference implementation demonstrates:
- AWS Cognito User Pool authentication using OIDC
- React OIDC Context integration
- Token management and refresh
- Protected routes and authentication state
- CloudScape Design System UI components

## Authentication Flow

### OIDC Integration
- **Authorization Code Flow**: Secure authentication with PKCE
- **Token Management**: Automatic token refresh and storage
- **User Profile**: Access to Cognito user attributes

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- AWS Cognito User Pool configured

### AWS Cognito Setup
1. Create a Cognito User Pool in AWS Console
2. Configure an App Client with:
   - Authorization code grant flow
   - PKCE enabled
   - Allowed callback URLs: `http://localhost:5173/auth/return`
   - Allowed sign-out URLs: `http://localhost:5173`
   - OpenID Connect scopes: `openid`, `email`

### Installation
```bash
npm install
```

### Configuration
Update the OIDC configuration in `src/index.tsx`:
```typescript
const cognitoAuthConfig = {
  authority: "https://cognito-idp.YOUR_REGION.amazonaws.com/YOUR_USER_POOL_ID",
  client_id: "YOUR_CLIENT_ID",
  redirect_uri: window.location.origin + "/auth/return",
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid email",
  automaticSilentRenew: true,
  loadUserInfo: true,
};
```

### Development
```bash
npm start          # Start development server
npm test           # Run unit tests
npm run build      # Build for production
```

## Project Structure

```
src/
├── component/     # React components
│   ├── AuthTest.tsx       # Authentication demo component
│   ├── Dashboard.tsx      # Protected dashboard
│   └── AuthCallback.tsx   # OIDC callback handler
├── lib/          # Business logic
│   └── utils.ts           # Utility functions
├── types/        # TypeScript definitions
└── styles.css    # Application styles
__tests__/        # Unit tests
```

## Development Guidelines

### Code Standards
- Follow React 19 best practices
- Use TypeScript strict mode
- External CSS only (no inline styles)
- JSDoc comments for all exports
- 80% test coverage for business logic

### Component Patterns
- Function components with hooks
- Props interfaces named `ComponentNameProps`
- Use `React.memo()` for performance optimization
- Semantic CSS class names

## Features

### Authentication Management
- **Login Flow**: Secure OIDC authentication with AWS Cognito
- **Token Display**: View ID and access tokens for debugging
- **User Profile**: Display Cognito user attributes
- **Session Management**: Automatic token refresh and logout

### Protected Routes
- **Route Protection**: Demonstrate protected content areas
- **Authentication State**: Show different UI based on auth status
- **Callback Handling**: Process OIDC authentication callbacks

## Security Considerations

- PKCE (Proof Key for Code Exchange) for secure authorization
- Automatic token refresh to maintain sessions
- Secure logout with Cognito hosted UI
- No sensitive data stored in localStorage

## Testing Strategy

- Unit tests for business logic
- Component testing with React Testing Library
- Integration tests for API calls
- E2E tests for critical workflows

## Deployment

### Build Process
```bash
npm run build
```

### Environment Configuration
- Development: Local development environment
- Staging: Pre-production testing
- Production: Live environment

## Contributing

1. Follow established code standards
2. Write tests for new features
3. Update documentation
4. Use semantic commit messages
5. Create pull requests for review

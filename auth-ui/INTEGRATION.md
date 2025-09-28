# Auth Service Integration Guide

This authentication service is designed to be deployed at `/auth/` path and used by multiple React applications in your CloudFront distribution.

## CloudFront Configuration

### Behavior Patterns
```
/auth/*     → S3 bucket with auth service
/app1/*     → S3 bucket with app1  
/app2/*     → S3 bucket with app2
/assets/*   → S3 bucket with shared assets
```

### Required Headers
Add these headers to your CloudFront distribution for the `/auth/*` behavior:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Integration in Other React Apps

### 1. Install the Auth Client
Copy `src/lib/authClient.ts` to your consuming applications.

### 2. Initialize Auth Client
```typescript
import { createAuthClient } from './lib/authClient';

const authClient = createAuthClient({
  authServiceUrl: 'https://yourdomain.com/auth'
});
```

### 3. Check Authentication Status
```typescript
const checkAuth = async () => {
  try {
    const tokens = await authClient.checkAuth();
    if (tokens) {
      // User is authenticated
      console.log('User:', tokens.user);
      console.log('ID Token:', tokens.idToken);
    } else {
      // User not authenticated
      console.log('Not authenticated');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
};
```

### 4. Login Flow
```typescript
const login = async () => {
  try {
    const tokens = await authClient.login();
    // Store tokens or update app state
    localStorage.setItem('authTokens', JSON.stringify(tokens));
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### 5. Logout
```typescript
const logout = () => {
  localStorage.removeItem('authTokens');
  authClient.logout();
};
```

## React Hook Example

Create a custom hook for easy integration:

```typescript
import { useState, useEffect } from 'react';
import { createAuthClient, AuthTokens } from './lib/authClient';

const authClient = createAuthClient({
  authServiceUrl: 'https://yourdomain.com/auth'
});

export const useAuth = () => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authTokens = await authClient.checkAuth();
      setTokens(authTokens);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const authTokens = await authClient.login();
      setTokens(authTokens);
      return authTokens;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setTokens(null);
    authClient.logout();
  };

  return {
    tokens,
    loading,
    isAuthenticated: !!tokens,
    login,
    logout
  };
};
```

## Deployment Structure

```
CloudFront Distribution
├── /auth/              # This auth service
│   ├── /               # AuthService component
│   ├── /login          # AuthTest component  
│   └── /callback       # AuthCallback component
├── /app1/              # Your React app 1
├── /app2/              # Your React app 2
└── /assets/            # Shared static assets
```

## Security Considerations

- Auth service handles all Cognito communication
- Other apps receive tokens via secure postMessage
- Tokens should be validated on your backend
- Use HTTPS for all communications
- Set appropriate CORS headers

## AWS Cognito Configuration

Update your Cognito App Client settings:
- Allowed callback URLs: `https://yourdomain.com/auth/callback`
- Allowed sign-out URLs: `https://yourdomain.com/auth/`
- Allowed origins: `https://yourdomain.com`

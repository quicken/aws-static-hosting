import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useSearchParams } from 'react-router-dom';
import { Container, Alert, Spinner } from '@cloudscape-design/components';

/**
 * Headless authentication handler
 * Sets secure JWT cookie and redirects back to origin
 */
const AuthHandler: React.FC = () => {
  const auth = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      if (auth.isAuthenticated && auth.user) {
        // Set secure JWT cookie for Lambda@Edge
        setSecureJWTCookie(auth.user.access_token);
        
        // Validate and redirect back to origin or specified return URL
        const returnUrl = validateReturnUrl(searchParams.get('return_url')) || '/';
        window.location.href = returnUrl;
      } else if (!auth.isLoading && !auth.isAuthenticated) {
        // Not authenticated, redirect to Cognito
        auth.signinRedirect();
      }
    };

    handleAuth();
  }, [auth.isAuthenticated, auth.isLoading, auth.user, searchParams]);

  if (auth.error) {
    return (
      <Container>
        <Alert type="error">
          Authentication failed. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="large" />
        <p>Processing authentication...</p>
      </div>
    </Container>
  );
};

/**
 * Set secure JWT cookie with name expected by Lambda@Edge
 * Uses cognito-token cookie name for Lambda@Edge integration
 */
const setSecureJWTCookie = (token: string) => {
  // Set cookie with name expected by Lambda@Edge
  document.cookie = `cognito-token=${token}; Secure; SameSite=Strict; Path=/; Max-Age=3600`;
};

/**
 * Validate return URL to prevent open redirect attacks
 * Only allows same-origin URLs and specific allowed paths
 */
const validateReturnUrl = (returnUrl: string | null): string | null => {
  if (!returnUrl) return null;
  
  try {
    // Allow relative paths that start with /
    if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      // Block common malicious patterns
      if (returnUrl.includes('javascript:') || returnUrl.includes('data:')) {
        return null;
      }
      return returnUrl;
    }
    
    // For absolute URLs, ensure same origin
    const url = new URL(returnUrl);
    const currentOrigin = window.location.origin;
    
    if (url.origin === currentOrigin) {
      return returnUrl;
    }
  } catch (error) {
    // Invalid URL format
    console.warn('Invalid return URL format:', returnUrl);
  }
  
  return null;
};

export default AuthHandler;

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
        
        // Get return URL from OAuth state or query parameter
        const returnUrl = getReturnUrl(auth.user, searchParams);
        const validatedUrl = validateReturnUrl(returnUrl) || '/';
        
        window.location.href = validatedUrl;
      } else if (!auth.isLoading && !auth.isAuthenticated) {
        // Get return URL and encode it in OAuth state
        const returnUrl = searchParams.get('return_url');
        if (returnUrl && validateReturnUrl(returnUrl)) {
          // Pass return URL via OAuth state parameter
          auth.signinRedirect({ state: { returnUrl } });
        } else {
          // Standard login without return URL
          auth.signinRedirect();
        }
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
 * Extract return URL from OAuth state or fallback to query parameter
 */
const getReturnUrl = (user: any, searchParams: URLSearchParams): string | null => {
  // First try OAuth state (most secure)
  if (user.state && typeof user.state === 'object' && user.state.returnUrl) {
    return user.state.returnUrl;
  }
  
  // Fallback to query parameter (less secure but compatible)
  return searchParams.get('return_url');
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

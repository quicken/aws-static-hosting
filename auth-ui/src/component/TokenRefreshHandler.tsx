import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

/**
 * Token refresh handler component
 * Updates JWT cookie when OIDC library automatically refreshes tokens
 */
const TokenRefreshHandler: React.FC = () => {
  const auth = useAuth();

  useEffect(() => {
    // Update cookie whenever user object changes (including token refresh)
    if (auth.isAuthenticated && auth.user?.access_token) {
      setSecureJWTCookie(auth.user.access_token);
    }
  }, [auth.user?.access_token, auth.isAuthenticated]);

  // This component renders nothing - it's just for side effects
  return null;
};

/**
 * Set secure JWT cookie with name expected by Lambda@Edge
 */
const setSecureJWTCookie = (token: string) => {
  document.cookie = `cognito-token=${token}; Secure; SameSite=Strict; Path=/; Max-Age=3600`;
};

export default TokenRefreshHandler;

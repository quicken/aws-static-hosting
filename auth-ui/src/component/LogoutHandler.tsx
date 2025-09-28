import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { Container, Spinner } from '@cloudscape-design/components';

/**
 * Logout handler component
 * Clears local session and redirects to Cognito logout
 */
const LogoutHandler: React.FC = () => {
  const auth = useAuth();

  useEffect(() => {
    const handleLogout = async () => {
      // Clear the cognito-token cookie
      document.cookie = 'cognito-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Strict';
      
      // Clear any other local storage
      sessionStorage.clear();
      localStorage.removeItem('authTokens');
      
      // Sign out from OIDC context and redirect to Cognito logout
      if (auth.isAuthenticated) {
        auth.signoutRedirect();
      } else {
        // If not authenticated, just redirect to home
        window.location.href = '/';
      }
    };

    handleLogout();
  }, [auth]);

  return (
    <Container>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="large" />
        <p>Signing out...</p>
      </div>
    </Container>
  );
};

export default LogoutHandler;

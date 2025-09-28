import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { Container, Header, Button, SpaceBetween, Alert } from '@cloudscape-design/components';

/**
 * AuthService component for handling authentication requests from other apps
 * Communicates via postMessage API for cross-origin authentication
 */
const AuthService: React.FC = () => {
  const auth = useAuth();

  useEffect(() => {
    // Listen for auth requests from parent apps
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'AUTH_REQUEST') {
        if (auth.isAuthenticated) {
          // Send tokens back to requesting app
          event.source?.postMessage({
            type: 'AUTH_SUCCESS',
            tokens: {
              idToken: auth.user?.id_token,
              accessToken: auth.user?.access_token,
              user: auth.user?.profile
            }
          }, event.origin);
        } else {
          // Redirect to login
          auth.signinRedirect();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [auth]);

  useEffect(() => {
    // Notify parent window when auth state changes
    if (auth.isAuthenticated && window.parent !== window) {
      window.parent.postMessage({
        type: 'AUTH_SUCCESS',
        tokens: {
          idToken: auth.user?.id_token,
          accessToken: auth.user?.access_token,
          user: auth.user?.profile
        }
      }, '*');
    }
  }, [auth.isAuthenticated, auth.user]);

  if (auth.isLoading) {
    return (
      <Container>
        <Alert type="info">Loading authentication...</Alert>
      </Container>
    );
  }

  if (auth.error) {
    return (
      <Container>
        <Alert type="error">Authentication error: {auth.error.message}</Alert>
      </Container>
    );
  }

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header variant="h1">Authentication Service</Header>
        
        {auth.isAuthenticated ? (
          <SpaceBetween direction="vertical" size="m">
            <Alert type="success">
              Authenticated as {auth.user?.profile?.email}
            </Alert>
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => auth.removeUser()}>
                Sign Out
              </Button>
              <Button 
                variant="primary"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="vertical" size="m">
            <Alert type="info">
              Please sign in to continue
            </Alert>
            <Button 
              variant="primary"
              onClick={() => auth.signinRedirect()}
            >
              Sign In
            </Button>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Container>
  );
};

export default AuthService;

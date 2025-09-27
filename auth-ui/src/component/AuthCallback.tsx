import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { Container, Alert, Spinner, SpaceBetween } from '@cloudscape-design/components';

/**
 * OAuth callback handler component for processing authentication returns
 * @returns JSX element for handling OAuth callback
 */
const AuthCallback: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // The react-oidc-context library should automatically handle the callback
        // but we can add custom logic here if needed
        console.log('Processing OAuth callback...');
        
        // Wait a moment for the auth context to process
        setTimeout(() => {
          if (auth.isAuthenticated) {
            console.log('Authentication successful, redirecting...');
            navigate('/entry'); // Redirect to auth test page to show results
          } else if (auth.error) {
            console.error('Authentication error:', auth.error);
          }
        }, 1000);
        
      } catch (error) {
        console.error('Callback processing error:', error);
      }
    };

    handleCallback();
  }, [auth.isAuthenticated, auth.error, navigate]);

  if (auth.error) {
    return (
      <Container>
        <Alert type="error" header="Authentication Failed">
          {auth.error.message}
        </Alert>
      </Container>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <Container>
        <Alert type="success" header="Authentication Successful">
          Redirecting to application...
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <SpaceBetween size="m">
        <Alert type="info" header="Processing Authentication">
          <Spinner /> Please wait while we complete your sign-in...
        </Alert>
      </SpaceBetween>
    </Container>
  );
};

export default AuthCallback;

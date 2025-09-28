import React from 'react';
import { useAuth } from 'react-oidc-context';
import { 
  Button, 
  Container, 
  Header, 
  SpaceBetween, 
  Alert, 
  Spinner,
  Box,
  ColumnLayout,
  CodeEditor
} from '@cloudscape-design/components';

/**
 * Authentication test component using react-oidc-context with Cognito
 * @returns JSX element for authentication testing
 */
const AuthTest: React.FC = () => {
  const auth = useAuth();
  const [persistedError, setPersistedError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (auth.error && !persistedError) {
      setPersistedError(auth.error);
    }
  }, [auth.error, persistedError]);

  /**
   * Handle sign out with proper Cognito logout URL
   */
  const handleSignOut = () => {
    const authority = auth.settings.authority;
    const clientId = auth.settings.client_id;
    const logoutUri = window.location.origin;
    
    // Use environment variable for Cognito domain if available
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN 
      ? `https://${import.meta.env.VITE_COGNITO_DOMAIN}.auth.${import.meta.env.VITE_COGNITO_REGION}.amazoncognito.com`
      : authority?.replace('cognito-idp', 'YOUR_COGNITO_DOMAIN.auth')
                  .replace('.amazonaws.com/', '.amazoncognito.com');
    
    if (cognitoDomain && clientId) {
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    } else {
      auth.removeUser();
    }
  };

  if (auth.isLoading) {
    return (
      <Container>
        <Alert type="info" header="Loading Authentication">
          <Spinner /> Checking authentication status...
        </Alert>
      </Container>
    );
  }

  if (persistedError) {
    return (
      <Container>
        <Alert type="error" header="Authentication Error">
          {persistedError.message}
          <SpaceBetween size="s" direction="horizontal">
            <Button onClick={() => setPersistedError(null)}>
              Dismiss
            </Button>
          </SpaceBetween>
        </Alert>
      </Container>
    );
  }

  if (auth.isAuthenticated && auth.user) {
    return (
      <Container>
        <SpaceBetween size="l">
          <Header variant="h1">Authentication Success</Header>
          
          <Alert type="success" header="Successfully Authenticated">
            Welcome, {auth.user.profile?.email || 'User'}!
          </Alert>

          <ColumnLayout columns={2}>
            <Box>
              <Header variant="h3">User Profile</Header>
              <SpaceBetween size="s">
                <div><strong>Email:</strong> {auth.user.profile?.email}</div>
                <div><strong>Name:</strong> {auth.user.profile?.name || 'Not provided'}</div>
                <div><strong>Phone:</strong> {auth.user.profile?.phone_number || 'Not provided'}</div>
                <div><strong>Subject:</strong> {auth.user.profile?.sub}</div>
              </SpaceBetween>
            </Box>

            <Box>
              <Header variant="h3">Token Information</Header>
              <SpaceBetween size="s">
                <div><strong>Token Type:</strong> {auth.user.token_type}</div>
                <div><strong>Expires At:</strong> {new Date(auth.user.expires_at * 1000).toLocaleString()}</div>
                <div><strong>Scope:</strong> {auth.user.scope}</div>
              </SpaceBetween>
            </Box>
          </ColumnLayout>

          <SpaceBetween size="m">
            <Box>
              <Header variant="h3">ID Token</Header>
              <CodeEditor
                ace={undefined}
                value={auth.user.id_token || 'No ID token'}
                language="json"
                onPreferencesChange={() => {}}
              />
            </Box>

            <Box>
              <Header variant="h3">Access Token</Header>
              <CodeEditor
                ace={undefined}
                value={auth.user.access_token || 'No access token'}
                language="json"
                onPreferencesChange={() => {}}
              />
            </Box>
          </SpaceBetween>

          <SpaceBetween direction="horizontal" size="s">
            <Button onClick={() => auth.removeUser()}>
              Sign Out (Local)
            </Button>
            <Button variant="primary" onClick={handleSignOut}>
              Sign Out (Cognito)
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Container>
    );
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h1">AWS Cognito Authentication Test</Header>
        
        <Alert type="info" header="Authentication Required">
          Please sign in to test the authentication flow with AWS Cognito.
        </Alert>

        <SpaceBetween direction="horizontal" size="s">
          <Button variant="primary" onClick={() => auth.signinRedirect()}>
            Sign In with Cognito
          </Button>
          <Button onClick={handleSignOut}>
            Sign Out
          </Button>
        </SpaceBetween>

        <Alert type="info" header="Configuration">
          <SpaceBetween size="xs">
            <div><strong>Authority:</strong> {auth.settings.authority}</div>
            <div><strong>Client ID:</strong> {auth.settings.client_id}</div>
            <div><strong>Redirect URI:</strong> {auth.settings.redirect_uri}</div>
            <div><strong>Scope:</strong> {auth.settings.scope}</div>
          </SpaceBetween>
        </Alert>
      </SpaceBetween>
    </Container>
  );
};

export default AuthTest;

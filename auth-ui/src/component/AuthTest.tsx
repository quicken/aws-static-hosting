import React from 'react';
import { useAuth } from 'react-oidc-context';

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
      <div className="container">
        <div className="alert info">
          <div className="spinner"></div>
          Checking authentication status...
        </div>
      </div>
    );
  }

  if (persistedError) {
    return (
      <div className="container">
        <div className="alert error">
          <strong>Authentication Error:</strong> {persistedError.message}
          <div style={{ marginTop: '10px' }}>
            <button className="button secondary" onClick={() => setPersistedError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated && auth.user) {
    return (
      <div className="container">
        <h1 className="header">Authentication Success</h1>
        
        <div className="alert success">
          <strong>Successfully Authenticated:</strong> Welcome, {auth.user.profile?.email || 'User'}!
        </div>

        <div className="debug-section">
          <h4>User Profile</h4>
          <div><strong>Email:</strong> {auth.user.profile?.email}</div>
          <div><strong>Name:</strong> {auth.user.profile?.name || 'Not provided'}</div>
          <div><strong>Phone:</strong> {auth.user.profile?.phone_number || 'Not provided'}</div>
          <div><strong>Subject:</strong> {auth.user.profile?.sub}</div>
        </div>

        <div className="debug-section">
          <h4>Token Information</h4>
          <div><strong>Token Type:</strong> {auth.user.token_type}</div>
          <div><strong>Expires At:</strong> {new Date(auth.user.expires_at * 1000).toLocaleString()}</div>
          <div><strong>Scope:</strong> {auth.user.scope}</div>
        </div>

        <div className="debug-section">
          <h4>ID Token</h4>
          <div className="code-block">{auth.user.id_token || 'No ID token'}</div>
        </div>

        <div className="debug-section">
          <h4>Access Token</h4>
          <div className="code-block">{auth.user.access_token || 'No access token'}</div>
        </div>

        <div className="space-between">
          <button className="button secondary" onClick={() => auth.removeUser()}>
            Sign Out (Local)
          </button>
          <button className="button" onClick={handleSignOut}>
            Sign Out (Cognito)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="header">AWS Cognito Authentication Test</h1>
      
      <div className="alert info">
        <strong>Authentication Required:</strong> Please sign in to test the authentication flow with AWS Cognito.
      </div>

      <div className="space-between">
        <button className="button" onClick={() => auth.signinRedirect()}>
          Sign In with Cognito
        </button>
        <button className="button secondary" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>

      <div className="debug-section">
        <h4>Configuration</h4>
        <div><strong>Authority:</strong> {auth.settings.authority}</div>
        <div><strong>Client ID:</strong> {auth.settings.client_id}</div>
        <div><strong>Redirect URI:</strong> {auth.settings.redirect_uri}</div>
        <div><strong>Scope:</strong> {auth.settings.scope}</div>
      </div>
    </div>
  );
};

export default AuthTest;

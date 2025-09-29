import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

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
          }, { targetOrigin: event.origin });
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
      <div className="container">
        <div className="alert info">Loading authentication...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="container">
        <div className="alert error">Authentication error: {auth.error.message}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="header">Authentication Service</h1>
      
      {auth.isAuthenticated ? (
        <div>
          <div className="alert success">
            Authenticated as {auth.user?.profile?.email}
          </div>
          <div className="space-between">
            <button 
              className="button secondary"
              onClick={() => auth.removeUser()}
            >
              Sign Out
            </button>
            <button 
              className="button"
              onClick={() => window.close()}
            >
              Close Window
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="alert info">
            Please sign in to continue
          </div>
          <button 
            className="button"
            onClick={() => auth.signinRedirect()}
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthService;

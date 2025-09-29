import React, { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

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
            navigate('/'); // Redirect to AuthHandler to process return URL
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
      <div className="container">
        <div className="alert error">
          <strong>Authentication Failed:</strong> {auth.error.message}
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="container">
        <div className="alert success">
          <strong>Authentication Successful:</strong> Redirecting to application...
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="alert info">
        <div className="spinner"></div>
        Please wait while we complete your sign-in...
      </div>
    </div>
  );
};

export default AuthCallback;

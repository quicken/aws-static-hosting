import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthProvider } from 'react-oidc-context';
import '@cloudscape-design/global-styles/index.css';
import AppLayoutWrapper from './component/AppLayout';
import AuthTest from './component/AuthTest';
import AuthCallback from './component/AuthCallback';
import AuthHandler from './component/AuthHandler';
import LogoutHandler from './component/LogoutHandler';
import TokenRefreshHandler from './component/TokenRefreshHandler';

/**
 * Cognito OIDC configuration
 * Uses environment variables that are compiled at build time
 */
const cognitoAuthConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: window.location.origin + import.meta.env.VITE_AUTH_BASE_PATH + "/callback",
  post_logout_redirect_uri: window.location.origin + import.meta.env.VITE_AUTH_BASE_PATH + "/",
  response_type: "code",
  scope: "openid email",
  automaticSilentRenew: true,
  loadUserInfo: true,
};

/**
 * Main application component with routing configuration
 * @returns JSX element for the entire application
 */
const App: React.FC = () => {
  const isDebugMode = import.meta.env.VITE_DEBUG_MODE === 'true';
  
  return (
    <Router basename={import.meta.env.VITE_AUTH_BASE_PATH}>
      <AppLayoutWrapper>
        {/* Token refresh handler - runs globally */}
        <TokenRefreshHandler />
        
        <Routes>
          {/* Headless auth handler - main production route */}
          <Route path="/" element={<AuthHandler />} />
          
          {/* OIDC callback - always needed */}
          <Route path="/callback" element={<AuthCallback />} />
          
          {/* Logout handler - always needed */}
          <Route path="/logout" element={<LogoutHandler />} />
          
          {/* Debug routes - only in debug mode */}
          {isDebugMode && (
            <Route path="/debug" element={<AuthTest />} />
          )}
        </Routes>
      </AppLayoutWrapper>
    </Router>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);


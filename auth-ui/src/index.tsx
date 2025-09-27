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
import Dashboard from './component/Dashboard';
import AuthTest from './component/AuthTest';
import AuthCallback from './component/AuthCallback';

/**
 * Cognito OIDC configuration
 * Uses environment variables that are compiled at build time
 */
const cognitoAuthConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: window.location.origin + "/auth/return",
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid email",
  automaticSilentRenew: true,
  loadUserInfo: true,
};

/**
 * Main application component with routing configuration
 * @returns JSX element for the entire application
 */
const App: React.FC = () => (
  <Router>
    <AppLayoutWrapper>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth-test" element={<AuthTest />} />
        <Route path="/auth/return" element={<AuthCallback />} />
      </Routes>
    </AppLayoutWrapper>
  </Router>
);

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


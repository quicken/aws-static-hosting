import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * Main application layout wrapper using simple HTML
 * @param children - Child components to render in content area
 * @returns JSX element for application layout
 */
const AppLayoutWrapper: React.FC<AppLayoutWrapperProps> = ({ children }) => {
  const location = useLocation();
  const isDebugMode = import.meta.env.VITE_DEBUG_MODE === 'true';

  // Only show sidebar on debug route
  if (isDebugMode && location.pathname === '/debug') {
    return (
      <div className="app-layout">
        <nav className="sidebar">
          <h3>AWS Cognito Auth</h3>
          <ul>
            <li>
              <Link 
                to="/" 
                className={location.pathname === '/' ? 'active' : ''}
              >
                Auth Handler
              </Link>
            </li>
            <li>
              <Link 
                to="/debug" 
                className={location.pathname === '/debug' ? 'active' : ''}
              >
                Debug
              </Link>
            </li>
          </ul>
        </nav>
        <main className="main-content">
          {children}
        </main>
      </div>
    );
  }

  // For all other routes, just show content without sidebar
  return <>{children}</>;
};

export default AppLayoutWrapper;

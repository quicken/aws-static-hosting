import React from 'react';
import { AppLayout, SideNavigation } from '@cloudscape-design/components';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * Main application layout wrapper using CloudScape AppLayout
 * @param children - Child components to render in content area
 * @returns JSX element for application layout
 */
const AppLayoutWrapper: React.FC<AppLayoutWrapperProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    {
      type: 'link' as const,
      text: 'Dashboard',
      href: '/',
    },
    {
      type: 'link' as const,
      text: 'Authentication Test',
      href: '/auth-test',
    },
  ];

  return (
    <AppLayout
      navigationOpen={true}
      navigationWidth={280}
      navigation={
        <SideNavigation
          header={{
            href: '/',
            text: 'AWS Cognito Auth',
          }}
          items={navigationItems}
          activeHref={location.pathname}
          onFollow={(event) => {
            if (!event.detail.external) {
              event.preventDefault();
              navigate(event.detail.href);
            }
          }}
        />
      }
      content={children}
      toolsHide={true}
      breadcrumbs={null}
    />
  );
};

export default AppLayoutWrapper;

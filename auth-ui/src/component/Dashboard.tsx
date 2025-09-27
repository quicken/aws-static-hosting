import React from 'react';
import { useAuth } from 'react-oidc-context';
import { 
  ContentLayout, 
  Header, 
  Button, 
  Container,
  SpaceBetween,
  Alert,
  Box,
  ColumnLayout
} from '@cloudscape-design/components';

/**
 * Protected dashboard component demonstrating authenticated content
 * @returns JSX element for dashboard page
 */
const Dashboard: React.FC = () => {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return (
      <ContentLayout
        header={<Header variant="h1">Dashboard</Header>}
      >
        <Alert type="warning" header="Authentication Required">
          Please sign in to access the dashboard.
          <Box margin={{ top: 's' }}>
            <Button variant="primary" onClick={() => auth.signinRedirect()}>
              Sign In
            </Button>
          </Box>
        </Alert>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Welcome to your authenticated dashboard"
        >
          Dashboard
        </Header>
      }
    >
      <SpaceBetween direction="vertical" size="l">
        <Alert type="success" header="Successfully Authenticated">
          You are now signed in and can access protected content.
        </Alert>

        <Container header={<Header variant="h2">User Information</Header>}>
          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Email</Box>
              <div>{auth.user?.profile?.email || 'Not available'}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Name</Box>
              <div>{auth.user?.profile?.name || 'Not provided'}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Subject ID</Box>
              <div>{auth.user?.profile?.sub}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Token Expires</Box>
              <div>
                {auth.user?.expires_at 
                  ? new Date(auth.user.expires_at * 1000).toLocaleString()
                  : 'Unknown'
                }
              </div>
            </div>
          </ColumnLayout>
        </Container>

        <Container header={<Header variant="h2">Protected Features</Header>}>
          <SpaceBetween direction="vertical" size="m">
            <Box>
              This is an example of protected content that only authenticated users can see.
              In a real application, this could include:
            </Box>
            <ul>
              <li>User-specific data and preferences</li>
              <li>Protected API endpoints</li>
              <li>Administrative functions</li>
              <li>Personalized content</li>
            </ul>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default Dashboard;

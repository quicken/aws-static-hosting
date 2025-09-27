# Configuration Guide

## AWS Cognito Setup

### 1. Create a Cognito User Pool

1. Go to the AWS Console and navigate to Amazon Cognito
2. Click "Create user pool"
3. Configure the following settings:
   - **Sign-in options**: Email
   - **Password policy**: Configure as needed
   - **MFA**: Optional (recommended for production)
   - **User account recovery**: Email only
   - **Self-service sign-up**: Enable
   - **Attribute verification**: Email

### 2. Configure App Client

1. In your User Pool, go to "App integration" tab
2. Click "Create app client"
3. Configure:
   - **App type**: Public client
   - **App client name**: `cognito-auth-reference`
   - **Client secret**: Don't generate (public client)
   - **Auth flows**: 
     - ✅ Authorization code grant
     - ✅ Allow refresh token auth
   - **OAuth 2.0 settings**:
     - **Allowed callback URLs**: `http://localhost:5173/auth/return`
     - **Allowed sign-out URLs**: `http://localhost:5173`
     - **OAuth grant types**: Authorization code
     - **OAuth scopes**: openid, email

### 3. Configure Hosted UI (Optional)

1. In "App integration" tab, scroll to "Domain"
2. Create a Cognito domain or use a custom domain
3. Note the domain URL for logout functionality

### 4. Update Application Configuration

Edit `src/index.tsx` and replace the placeholder values:

```typescript
const cognitoAuthConfig = {
  authority: "https://cognito-idp.YOUR_REGION.amazonaws.com/YOUR_USER_POOL_ID",
  client_id: "YOUR_CLIENT_ID",
  redirect_uri: window.location.origin + "/auth/return",
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid email",
  automaticSilentRenew: true,
  loadUserInfo: true,
};
```

**Where to find these values:**
- **YOUR_REGION**: Your AWS region (e.g., `us-east-1`, `eu-west-1`)
- **YOUR_USER_POOL_ID**: Found in User Pool "General settings"
- **YOUR_CLIENT_ID**: Found in "App integration" > "App clients and analytics"

### 5. Update Logout URL (Optional)

If you configured a Cognito domain, update the logout function in `src/component/AuthTest.tsx`:

```typescript
const cognitoDomain = "https://YOUR_COGNITO_DOMAIN.auth.YOUR_REGION.amazoncognito.com";
```

Replace `YOUR_COGNITO_DOMAIN` with your actual domain name.

## Environment Variables (Alternative)

For better security, you can use environment variables:

1. Create a `.env.local` file:
```
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=your-domain-name
```

2. Update `src/index.tsx` to use environment variables:
```typescript
const cognitoAuthConfig = {
  authority: `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  // ... rest of config
};
```

## Testing the Setup

1. Start the development server: `npm start`
2. Navigate to "Authentication Test" in the sidebar
3. Click "Sign In with Cognito"
4. You should be redirected to the Cognito hosted UI
5. After successful authentication, you'll see user profile and token information

## Troubleshooting

### Common Issues

1. **Redirect URI mismatch**: Ensure callback URLs in Cognito match your application URLs
2. **CORS errors**: Check that your domain is properly configured in Cognito
3. **Token validation errors**: Verify your User Pool ID and region are correct
4. **Logout not working**: Ensure you have a Cognito domain configured and the logout URL is correct

### Debug Information

The Authentication Test page displays:
- Current configuration values
- User profile information
- Token details
- Error messages

Use this information to verify your setup is correct.

import { CloudFrontRequest } from "aws-lambda";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-client";

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-2";

// JWKS client with caching for Cognito public keys
const client = jwksClient({
  jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
});

/**
 * Gets signing key for JWT verification
 */
function getKey(header: jwt.JwtHeader, callback: (err: any, signingKey?: string) => void) {
  try {
    if (!header.kid) {
      console.error('No kid in token header');
      callback(new Error('No kid in token header'));
      return;
    }
    
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        console.error('Error getting signing key:', err);
        callback(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  } catch (error) {
    console.error('Error in getKey:', error);
    callback(error);
  }
}

/**
 * Extracts JWT token from cognito-token cookie in CloudFront request
 * @param request - CloudFront request object
 * @returns JWT token string or null if not found
 */
export function extractJwtToken(request: CloudFrontRequest): string | null {
  try {
    console.log('Extracting JWT token from request headers:', JSON.stringify(request.headers, null, 2));
    
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader || cookieHeader.length === 0) {
      console.log('No cookie header found');
      return null;
    }
    
    const cookies = cookieHeader[0].value;
    console.log('Cookie string:', cookies);
    
    const match = cookies.match(/cognito-token=([^;]+)/);
    const token = match ? match[1] : null;
    
    console.log('Extracted token:', token ? 'Found token' : 'No token found');
    return token;
  } catch (error) {
    console.error('Error extracting JWT token:', error);
    return null;
  }
}

/**
 * Validates Cognito JWT token with proper signature verification
 * @param token - JWT token to validate
 * @returns Promise resolving to true if token is valid
 */
export async function validateJwtToken(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      console.log('Validating JWT token');
      
      // Verify JWT signature and decode payload
      jwt.verify(token, getKey, {
        issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
        audience: COGNITO_CLIENT_ID,
        algorithms: ['RS256']
      }, (err: any, decoded: any) => {
        if (err) {
          console.error('JWT verification failed:', err.message);
          resolve(false);
          return;
        }

        console.log('JWT decoded successfully:', { token_use: decoded.token_use, exp: decoded.exp });

        // Additional Cognito-specific validations
        if (decoded.token_use !== 'access' && decoded.token_use !== 'id') {
          console.error('Invalid token_use:', decoded.token_use);
          resolve(false);
          return;
        }

        console.log('JWT validation successful');
        resolve(true);
      });
    } catch (error) {
      console.error('Error in validateJwtToken:', error);
      resolve(false);
    }
  });
}

/**
 * Checks if the request is authenticated
 * @param request - CloudFront request object
 * @returns Promise resolving to true if authenticated
 */
export async function isAuthenticated(request: CloudFrontRequest): Promise<boolean> {
  try {
    console.log('Checking authentication');
    
    const token = extractJwtToken(request);
    if (!token) {
      console.log('No token found, not authenticated');
      return false;
    }
    
    const isValid = await validateJwtToken(token);
    console.log('Authentication result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error in isAuthenticated:', error);
    return false;
  }
}

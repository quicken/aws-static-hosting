import { APIGatewayProxyEvent } from "aws-lambda";
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
  if (!header.kid) {
    callback(new Error('No kid in token header'));
    return;
  }
  
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Extracts JWT token from cognito-token cookie
 * @param event - API Gateway proxy event
 * @returns JWT token string or null if not found
 */
export function extractJwtToken(event: APIGatewayProxyEvent): string | null {
  const cookies = event.headers.Cookie || event.headers.cookie || "";
  const match = cookies.match(/cognito-token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Validates Cognito JWT token with proper signature verification
 * @param token - JWT token to validate
 * @returns Promise resolving to true if token is valid
 */
export async function validateJwtToken(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Verify JWT signature and decode payload
      jwt.verify(token, getKey, {
        issuer: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
        audience: COGNITO_CLIENT_ID,
        algorithms: ['RS256']
      }, (err: any, decoded: any) => {
        if (err) {
          resolve(false);
          return;
        }

        // Additional Cognito-specific validations
        if (decoded.token_use !== 'access' && decoded.token_use !== 'id') {
          resolve(false);
          return;
        }

        resolve(true);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Checks if the request is authenticated
 * @param event - API Gateway proxy event
 * @returns Promise resolving to true if authenticated
 */
export async function isAuthenticated(event: APIGatewayProxyEvent): Promise<boolean> {
  const token = extractJwtToken(event);
  if (!token) return false;
  return await validateJwtToken(token);
}

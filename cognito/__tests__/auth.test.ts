import { describe, it, expect } from 'vitest';
import { extractJwtToken } from '../src/lib/auth';
import { APIGatewayProxyEvent } from 'aws-lambda';

describe('Auth utilities', () => {
  describe('extractJwtToken', () => {
    it('should extract token from Cookie header', () => {
      const event = {
        headers: {
          Cookie: 'cognito-token=eyJhbGciOiJIUzI1NiJ9.test.signature; other=value'
        }
      } as APIGatewayProxyEvent;

      expect(extractJwtToken(event)).toBe('eyJhbGciOiJIUzI1NiJ9.test.signature');
    });

    it('should extract token from cookie header (lowercase)', () => {
      const event = {
        headers: {
          cookie: 'cognito-token=eyJhbGciOiJIUzI1NiJ9.test.signature'
        }
      } as APIGatewayProxyEvent;

      expect(extractJwtToken(event)).toBe('eyJhbGciOiJIUzI1NiJ9.test.signature');
    });

    it('should return null when no cookie header', () => {
      const event = {
        headers: {}
      } as APIGatewayProxyEvent;

      expect(extractJwtToken(event)).toBeNull();
    });

    it('should return null when cognito-token not found', () => {
      const event = {
        headers: {
          Cookie: 'other-cookie=value'
        }
      } as APIGatewayProxyEvent;

      expect(extractJwtToken(event)).toBeNull();
    });
  });
});

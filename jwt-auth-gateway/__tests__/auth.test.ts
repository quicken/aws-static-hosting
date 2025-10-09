import { describe, it, expect } from 'vitest';
import { extractJwtToken } from '../src/lib/auth';
import { CloudFrontRequest } from 'aws-lambda';

describe('Auth utilities', () => {
  describe('extractJwtToken', () => {
    it('should extract token from cookie header', () => {
      const request = {
        headers: {
          cookie: [{ key: 'Cookie', value: 'cognito-token=eyJhbGciOiJIUzI1NiJ9.test.signature; other=value' }]
        }
      } as CloudFrontRequest;

      expect(extractJwtToken(request)).toBe('eyJhbGciOiJIUzI1NiJ9.test.signature');
    });

    it('should return null when no cookie header', () => {
      const request = {
        headers: {}
      } as CloudFrontRequest;

      expect(extractJwtToken(request)).toBeNull();
    });

    it('should return null when cognito-token not found', () => {
      const request = {
        headers: {
          cookie: [{ key: 'Cookie', value: 'other-cookie=value' }]
        }
      } as CloudFrontRequest;

      expect(extractJwtToken(request)).toBeNull();
    });

    it('should handle cognito-token at different positions', () => {
      const request = {
        headers: {
          cookie: [{ key: 'Cookie', value: 'first=value; cognito-token=xyz789; last=value' }]
        }
      } as CloudFrontRequest;

      expect(extractJwtToken(request)).toBe('xyz789');
    });
  });
});

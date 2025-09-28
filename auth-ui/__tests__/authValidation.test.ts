import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Extract validateReturnUrl function for testing
 * This is the critical security business logic
 */
const validateReturnUrl = (returnUrl: string | null, currentOrigin: string = 'https://example.com'): string | null => {
  if (!returnUrl) return null;
  
  try {
    // Allow relative paths that start with /
    if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      // Block common malicious patterns
      if (returnUrl.includes('javascript:') || returnUrl.includes('data:')) {
        return null;
      }
      return returnUrl;
    }
    
    // For absolute URLs, ensure same origin
    const url = new URL(returnUrl);
    
    if (url.origin === currentOrigin) {
      return returnUrl;
    }
  } catch (error) {
    // Invalid URL format
    return null;
  }
  
  return null;
};

describe('validateReturnUrl', () => {
  const currentOrigin = 'https://example.com';

  describe('valid return URLs', () => {
    it('should allow valid relative paths', () => {
      expect(validateReturnUrl('/dashboard', currentOrigin)).toBe('/dashboard');
      expect(validateReturnUrl('/app1/users', currentOrigin)).toBe('/app1/users');
      expect(validateReturnUrl('/app2/settings?tab=profile', currentOrigin)).toBe('/app2/settings?tab=profile');
      expect(validateReturnUrl('/', currentOrigin)).toBe('/');
    });

    it('should allow same-origin absolute URLs', () => {
      expect(validateReturnUrl('https://example.com/dashboard', currentOrigin)).toBe('https://example.com/dashboard');
      expect(validateReturnUrl('https://example.com/app1/users', currentOrigin)).toBe('https://example.com/app1/users');
    });
  });

  describe('invalid return URLs', () => {
    it('should reject null/empty URLs', () => {
      expect(validateReturnUrl(null, currentOrigin)).toBe(null);
      expect(validateReturnUrl('', currentOrigin)).toBe(null);
    });

    it('should reject protocol-relative URLs', () => {
      expect(validateReturnUrl('//evil.com/phishing', currentOrigin)).toBe(null);
      expect(validateReturnUrl('//example.com/dashboard', currentOrigin)).toBe(null);
    });

    it('should reject javascript: URLs', () => {
      expect(validateReturnUrl('/dashboard?redirect=javascript:alert(1)', currentOrigin)).toBe(null);
      expect(validateReturnUrl('javascript:alert("xss")', currentOrigin)).toBe(null);
    });

    it('should reject data: URLs', () => {
      expect(validateReturnUrl('/dashboard?redirect=data:text/html,<script>alert(1)</script>', currentOrigin)).toBe(null);
      expect(validateReturnUrl('data:text/html,<h1>XSS</h1>', currentOrigin)).toBe(null);
    });

    it('should reject different origin URLs', () => {
      expect(validateReturnUrl('https://evil.com/phishing', currentOrigin)).toBe(null);
      expect(validateReturnUrl('http://example.com/dashboard', currentOrigin)).toBe(null);
      expect(validateReturnUrl('https://subdomain.example.com/dashboard', currentOrigin)).toBe(null);
    });

    it('should reject malformed URLs', () => {
      expect(validateReturnUrl('not-a-url', currentOrigin)).toBe(null);
      expect(validateReturnUrl('http://', currentOrigin)).toBe(null);
      expect(validateReturnUrl('://invalid', currentOrigin)).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with fragments and query params', () => {
      expect(validateReturnUrl('/dashboard#section', currentOrigin)).toBe('/dashboard#section');
      expect(validateReturnUrl('/app?param=value&other=test', currentOrigin)).toBe('/app?param=value&other=test');
    });

    it('should handle encoded URLs', () => {
      expect(validateReturnUrl('/dashboard%20test', currentOrigin)).toBe('/dashboard%20test');
      expect(validateReturnUrl('/app?redirect=%2Fdashboard', currentOrigin)).toBe('/app?redirect=%2Fdashboard');
    });
  });
});

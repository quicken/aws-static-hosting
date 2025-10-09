import { describe, it, expect, beforeEach } from 'vitest';
import { isPublicPath, rewrite } from '../src/lib/routing';

describe('Routing utilities', () => {
  beforeEach(() => {
    delete process.env.SPA_BASE_PATH;
  });

  describe('rewrite', () => {
    it('should rewrite root path to /public/index.html', () => {
      expect(rewrite('/')).toBe('/public/index.html');
    });

    it('should rewrite auth paths to /auth/index.html', () => {
      expect(rewrite('/auth')).toBe('/auth/index.html');
      expect(rewrite('/auth/')).toBe('/auth/index.html');
      expect(rewrite('/auth/callback')).toBe('/auth/index.html');
    });

    it('should not rewrite asset files', () => {
      expect(rewrite('/assets/main.js')).toBe('/assets/main.js');
      expect(rewrite('/favicon.ico')).toBe('/favicon.ico');
      expect(rewrite('/index.html')).toBe('/index.html');
    });

    it('should not rewrite SPA routes when no base path configured', () => {
      expect(rewrite('/dashboard')).toBe('/dashboard');
      expect(rewrite('/users/123')).toBe('/users/123');
    });

    it('should rewrite SPA routes under base path', () => {
      process.env.SPA_BASE_PATH = 'apps';
      expect(rewrite('/apps/dashboard')).toBe('/apps/dashboard/index.html');
      expect(rewrite('/apps/admin/users')).toBe('/apps/admin/index.html');
    });

    it('should rewrite base path only to base index.html', () => {
      process.env.SPA_BASE_PATH = 'apps';
      expect(rewrite('/apps')).toBe('/apps/index.html');
    });

    it('should not rewrite paths outside base path', () => {
      process.env.SPA_BASE_PATH = 'apps';
      expect(rewrite('/dashboard')).toBe('/dashboard');
      expect(rewrite('/other/path')).toBe('/other/path');
    });
  });

  describe('isPublicPath', () => {
    it('should return true for root path', () => {
      expect(isPublicPath('/')).toBe(true);
    });

    it('should return true for index.html', () => {
      expect(isPublicPath('/index.html')).toBe(true);
    });

    it('should return true for auth paths', () => {
      expect(isPublicPath('/auth')).toBe(true);
      expect(isPublicPath('/auth/')).toBe(true);
      expect(isPublicPath('/auth/callback')).toBe(true);
      expect(isPublicPath('/auth/logout')).toBe(true);
    });

    it('should return true for public path', () => {
      expect(isPublicPath('/public')).toBe(true);
    });

    it('should return false for all other paths', () => {
      expect(isPublicPath('/dashboard')).toBe(false);
      expect(isPublicPath('/users/123')).toBe(false);
      expect(isPublicPath('/assets/main.js')).toBe(false);
      expect(isPublicPath('/favicon.ico')).toBe(false);
      expect(isPublicPath('/apps/dashboard')).toBe(false);
    });
  });
});

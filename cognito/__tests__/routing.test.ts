import { describe, it, expect, beforeEach } from 'vitest';
import { isSpaRoute, isPublicPath } from '../src/lib/routing';

describe('Routing utilities', () => {
  beforeEach(() => {
    delete process.env.SPA_BASE_PATH;
  });

  describe('isSpaRoute', () => {
    it('should return true for root path', () => {
      expect(isSpaRoute('/')).toBe(true);
    });

    it('should return true for paths without file extensions', () => {
      expect(isSpaRoute('/dashboard')).toBe(true);
      expect(isSpaRoute('/users/123')).toBe(true);
      expect(isSpaRoute('/admin/settings')).toBe(true);
      expect(isSpaRoute('/public/login')).toBe(true);
      expect(isSpaRoute('/public/oauth/callback')).toBe(true);
    });

    it('should return false for asset paths with extensions', () => {
      expect(isSpaRoute('/assets/main.js')).toBe(false);
      expect(isSpaRoute('/assets/style.css')).toBe(false);
      expect(isSpaRoute('/favicon.ico')).toBe(false);
      expect(isSpaRoute('/manifest.json')).toBe(false);
      expect(isSpaRoute('/index.html')).toBe(false);
    });
  });

  describe('isPublicPath', () => {
    it('should return true for public paths', () => {
      expect(isPublicPath('/')).toBe(true);
      expect(isPublicPath('/index.html')).toBe(true);
      expect(isPublicPath('/public')).toBe(true);
      expect(isPublicPath('/public/login')).toBe(true);
      expect(isPublicPath('/public/oauth/callback')).toBe(true);
      expect(isPublicPath('/auth')).toBe(true);
      expect(isPublicPath('/auth/')).toBe(true);
      expect(isPublicPath('/auth/callback')).toBe(true);
      expect(isPublicPath('/auth/logout')).toBe(true);
    });

    it('should return true for paths when no SPA base path is configured', () => {
      expect(isPublicPath('/dashboard')).toBe(true);
      expect(isPublicPath('/users/123')).toBe(true);
      expect(isPublicPath('/assets/main.js')).toBe(true);
      expect(isPublicPath('/favicon.ico')).toBe(true);
    });

    it('should return false for protected paths under SPA base path', () => {
      process.env.SPA_BASE_PATH = 'apps';
      expect(isPublicPath('/apps/dashboard')).toBe(false);
      expect(isPublicPath('/apps/users/123')).toBe(false);
    });

    it('should return true for paths outside SPA base path', () => {
      process.env.SPA_BASE_PATH = 'apps';
      expect(isPublicPath('/dashboard')).toBe(true);
      expect(isPublicPath('/users/123')).toBe(true);
      expect(isPublicPath('/assets/main.js')).toBe(true);
    });
  });

  describe('SPA base path routing examples', () => {
    const examples = [
      { path: '/', isSpa: true, isPublic: true, description: 'Root - Always Public' },
      { path: '/index.html', isSpa: false, isPublic: true, description: 'Index HTML - Always Public' },
      { path: '/auth/', isSpa: true, isPublic: true, description: 'Auth Service - Always Public' },
      { path: '/auth/callback', isSpa: true, isPublic: true, description: 'Auth Callback - Always Public' },
      { path: '/public/login', isSpa: true, isPublic: true, description: 'Public - Always Public' },
      { path: '/dashboard', isSpa: true, isPublic: true, description: 'Dashboard - Public (no base path)' },
      { path: '/assets/main.js', isSpa: false, isPublic: true, description: 'JS Asset - Public (no base path)' },
      { path: '/favicon.ico', isSpa: false, isPublic: true, description: 'Icon Asset - Public (no base path)' },
    ];

    examples.forEach(({ path, isSpa, isPublic, description }) => {
      it(`should correctly classify ${description}: ${path}`, () => {
        expect(isSpaRoute(path)).toBe(isSpa);
        expect(isPublicPath(path)).toBe(isPublic);
      });
    });
  });

  describe('SPA base path routing examples with apps base path', () => {
    const examples = [
      { path: '/apps/dashboard', isSpa: true, isPublic: false, description: 'Protected SPA under base path' },
      { path: '/apps/admin/users', isSpa: true, isPublic: false, description: 'Protected SPA deep route' },
      { path: '/dashboard', isSpa: true, isPublic: true, description: 'Public route outside base path' },
    ];

    examples.forEach(({ path, isSpa, isPublic, description }) => {
      it(`should correctly classify ${description}: ${path}`, () => {
        process.env.SPA_BASE_PATH = 'apps';
        expect(isSpaRoute(path)).toBe(isSpa);
        expect(isPublicPath(path)).toBe(isPublic);
      });
    });
  });
});

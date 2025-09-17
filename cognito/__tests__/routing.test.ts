import { describe, it, expect } from 'vitest';
import { isSpaRoute, isPublicPath } from '../src/lib/routing';

describe('Routing utilities', () => {
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
    });
  });

  describe('isPublicPath', () => {
    it('should return true for public paths', () => {
      expect(isPublicPath('/public')).toBe(true);
      expect(isPublicPath('/public/login')).toBe(true);
      expect(isPublicPath('/public/oauth/callback')).toBe(true);
    });

    it('should return false for protected paths', () => {
      expect(isPublicPath('/')).toBe(false);
      expect(isPublicPath('/dashboard')).toBe(false);
      expect(isPublicPath('/users/123')).toBe(false);
    });
  });

  describe('README routing examples', () => {
    const examples = [
      { path: '/', isSpa: true, isPublic: false, description: 'Root - SPA Protected' },
      { path: '/dashboard', isSpa: true, isPublic: false, description: 'Dashboard - SPA Protected' },
      { path: '/public/login', isSpa: true, isPublic: true, description: 'Login - SPA Public' },
      { path: '/public/oauth/callback', isSpa: true, isPublic: true, description: 'OAuth - SPA Public' },
      { path: '/assets/main.js', isSpa: false, isPublic: false, description: 'JS Asset' },
      { path: '/favicon.ico', isSpa: false, isPublic: false, description: 'Icon Asset' },
    ];

    examples.forEach(({ path, isSpa, isPublic, description }) => {
      it(`should correctly classify ${description}: ${path}`, () => {
        expect(isSpaRoute(path)).toBe(isSpa);
        expect(isPublicPath(path)).toBe(isPublic);
      });
    });
  });
});

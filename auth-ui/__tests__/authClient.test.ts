import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthClient, createAuthClient } from '../src/lib/authClient';

// Mock DOM APIs
const mockPostMessage = vi.fn();
const mockClose = vi.fn();
const mockOpen = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock window.open
  global.window.open = mockOpen;
  
  // Mock document methods
  global.document.createElement = vi.fn((tag) => {
    if (tag === 'iframe') {
      return {
        src: '',
        style: { display: '' },
        onload: null,
        contentWindow: { postMessage: mockPostMessage }
      };
    }
    return {};
  });
  
  // Mock document.body properly
  Object.defineProperty(global.document, 'body', {
    value: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild
    },
    writable: true
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthClient', () => {
  describe('constructor', () => {
    it('should create client with default timeout', () => {
      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      expect(client).toBeInstanceOf(AuthClient);
    });

    it('should create client with custom timeout', () => {
      const client = new AuthClient({ 
        authServiceUrl: 'https://example.com/auth',
        timeout: 60000
      });
      expect(client).toBeInstanceOf(AuthClient);
    });
  });

  describe('checkAuth', () => {
    it('should resolve with tokens on AUTH_SUCCESS', async () => {
      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      const mockTokens = { idToken: 'id123', accessToken: 'access123', user: { email: 'test@example.com' } };

      // Start checkAuth
      const authPromise = client.checkAuth();

      // Simulate message event
      const messageEvent = new MessageEvent('message', {
        data: { type: 'AUTH_SUCCESS', tokens: mockTokens },
        origin: 'https://example.com'
      });
      
      // Trigger the event listener
      setTimeout(() => {
        window.dispatchEvent(messageEvent);
      }, 10);

      const result = await authPromise;
      expect(result).toEqual(mockTokens);
    });

    it('should resolve with null on AUTH_ERROR', async () => {
      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });

      const authPromise = client.checkAuth();

      const messageEvent = new MessageEvent('message', {
        data: { type: 'AUTH_ERROR' },
        origin: 'https://example.com'
      });
      
      setTimeout(() => {
        window.dispatchEvent(messageEvent);
      }, 10);

      const result = await authPromise;
      expect(result).toBe(null);
    });

    it('should reject on timeout', async () => {
      const client = new AuthClient({ 
        authServiceUrl: 'https://example.com/auth',
        timeout: 100
      });

      await expect(client.checkAuth()).rejects.toThrow('Auth check timeout');
    });

    it('should ignore messages from wrong origin', async () => {
      const client = new AuthClient({ 
        authServiceUrl: 'https://example.com/auth',
        timeout: 100
      });

      const authPromise = client.checkAuth();

      // Send message from wrong origin
      const messageEvent = new MessageEvent('message', {
        data: { type: 'AUTH_SUCCESS', tokens: {} },
        origin: 'https://evil.com'
      });
      
      setTimeout(() => {
        window.dispatchEvent(messageEvent);
      }, 10);

      await expect(authPromise).rejects.toThrow('Auth check timeout');
    });
  });

  describe('login', () => {
    it('should resolve with tokens on successful login', async () => {
      const mockTokens = { idToken: 'id123', accessToken: 'access123', user: { email: 'test@example.com' } };
      const mockPopup = { close: mockClose, closed: false };
      mockOpen.mockReturnValue(mockPopup);

      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      const loginPromise = client.login();

      const messageEvent = new MessageEvent('message', {
        data: { type: 'AUTH_SUCCESS', tokens: mockTokens },
        origin: 'https://example.com'
      });
      
      setTimeout(() => {
        window.dispatchEvent(messageEvent);
      }, 10);

      const result = await loginPromise;
      expect(result).toEqual(mockTokens);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should reject if popup fails to open', async () => {
      mockOpen.mockReturnValue(null);

      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      
      await expect(client.login()).rejects.toThrow('Failed to open popup');
    });

    it('should reject on AUTH_ERROR', async () => {
      const mockPopup = { close: mockClose, closed: false };
      mockOpen.mockReturnValue(mockPopup);

      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      const loginPromise = client.login();

      const messageEvent = new MessageEvent('message', {
        data: { type: 'AUTH_ERROR', error: 'Login failed' },
        origin: 'https://example.com'
      });
      
      setTimeout(() => {
        window.dispatchEvent(messageEvent);
      }, 10);

      await expect(loginPromise).rejects.toThrow('Login failed');
      expect(mockClose).toHaveBeenCalled();
    });

    it('should reject if popup is closed manually', async () => {
      const mockPopup = { close: mockClose, closed: false };
      mockOpen.mockReturnValue(mockPopup);

      const client = new AuthClient({ 
        authServiceUrl: 'https://example.com/auth',
        timeout: 5000 // Longer timeout to ensure popup close is detected first
      });
      const loginPromise = client.login();

      // Simulate popup being closed quickly
      setTimeout(() => {
        mockPopup.closed = true;
      }, 10);

      await expect(loginPromise).rejects.toThrow('Login cancelled');
    });
  });

  describe('logout', () => {
    it('should redirect to logout URL', () => {
      // Mock window.location
      delete (window as any).location;
      window.location = { href: '' } as any;

      const client = new AuthClient({ authServiceUrl: 'https://example.com/auth' });
      client.logout();

      expect(window.location.href).toBe('https://example.com/auth/logout');
    });
  });
});

describe('createAuthClient', () => {
  it('should create AuthClient instance', () => {
    const client = createAuthClient({ authServiceUrl: 'https://example.com/auth' });
    expect(client).toBeInstanceOf(AuthClient);
  });
});

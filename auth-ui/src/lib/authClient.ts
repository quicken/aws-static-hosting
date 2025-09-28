/**
 * Authentication client for consuming React applications
 * Communicates with the centralized auth service via iframe/popup
 */

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  user: any;
}

export interface AuthClientConfig {
  authServiceUrl: string; // e.g., "https://yourdomain.com/auth"
  timeout?: number;
}

export class AuthClient {
  private config: AuthClientConfig;
  private iframe?: HTMLIFrameElement;

  constructor(config: AuthClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  /**
   * Check if user is authenticated by communicating with auth service
   */
  async checkAuth(): Promise<AuthTokens | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error('Auth check timeout'));
      }, this.config.timeout);

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== new URL(this.config.authServiceUrl).origin) {
          return;
        }

        if (event.data.type === 'AUTH_SUCCESS') {
          clearTimeout(timeout);
          this.cleanup();
          resolve(event.data.tokens);
        } else if (event.data.type === 'AUTH_ERROR') {
          clearTimeout(timeout);
          this.cleanup();
          resolve(null);
        }
      };

      window.addEventListener('message', handleMessage);

      // Create hidden iframe to check auth status
      this.iframe = document.createElement('iframe');
      this.iframe.src = this.config.authServiceUrl;
      this.iframe.style.display = 'none';
      document.body.appendChild(this.iframe);

      // Send auth request after iframe loads
      this.iframe.onload = () => {
        this.iframe?.contentWindow?.postMessage({
          type: 'AUTH_REQUEST'
        }, this.config.authServiceUrl);
      };
    });
  }

  /**
   * Initiate login flow by opening auth service in popup
   */
  async login(): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        `${this.config.authServiceUrl}/login`,
        'auth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Failed to open popup'));
        return;
      }

      const timeout = setTimeout(() => {
        popup.close();
        reject(new Error('Login timeout'));
      }, this.config.timeout);

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== new URL(this.config.authServiceUrl).origin) {
          return;
        }

        if (event.data.type === 'AUTH_SUCCESS') {
          clearTimeout(timeout);
          popup.close();
          window.removeEventListener('message', handleMessage);
          resolve(event.data.tokens);
        } else if (event.data.type === 'AUTH_ERROR') {
          clearTimeout(timeout);
          popup.close();
          window.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Login cancelled'));
        }
      }, 1000);
    });
  }

  /**
   * Logout by redirecting to auth service
   */
  logout(): void {
    window.location.href = `${this.config.authServiceUrl}/logout`;
  }

  private cleanup(): void {
    if (this.iframe) {
      document.body.removeChild(this.iframe);
      this.iframe = undefined;
    }
  }
}

/**
 * Create auth client instance
 */
export const createAuthClient = (config: AuthClientConfig): AuthClient => {
  return new AuthClient(config);
};

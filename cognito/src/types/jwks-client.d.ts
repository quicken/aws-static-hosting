declare module 'jwks-client' {
  interface SigningKey {
    getPublicKey(): string;
  }

  interface JwksClientOptions {
    jwksUri: string;
    cache?: boolean;
    rateLimit?: boolean;
    cacheMaxAge?: number;
    cacheMaxEntries?: number;
    jwksRequestsPerMinute?: number;
  }

  interface JwksClient {
    getSigningKey(kid: string, callback: (err: Error | null, key?: SigningKey) => void): void;
  }

  function jwksClient(options: JwksClientOptions): JwksClient;
  export = jwksClient;
}

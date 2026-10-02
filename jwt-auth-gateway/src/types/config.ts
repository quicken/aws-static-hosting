/**
 * Shapes shared between the build script, the edge functions and the tests.
 */

/** One RSA public key from a Cognito user pool's JWKS endpoint. */
export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export interface Jwks {
  keys: Jwk[];
}

/**
 * Configuration for the Lambda@Edge auth routes, baked in at build time because Lambda@Edge has
 * no environment variables.
 */
export interface EdgeConfig {
  /** Region of the Cognito user pool, e.g. `ap-southeast-2`. */
  region: string;
  userPoolId: string;
  /** Public (PKCE) app client id. Also the `aud` claim every id-token must carry. */
  clientId: string;
  /** Hosted UI / managed login host, e.g. `my-prefix.auth.ap-southeast-2.amazoncognito.com`. */
  hostedUiDomain: string;
  /** User pool's public signing keys at build time. Unknown keys are fetched at runtime. */
  jwks: Jwks;
  /** HMAC key for the sign-in state cookie. Generated fresh by every build. */
  flowKey: string;
  /** Current session key: stamps every id-token the auth routes hand out. */
  sessionKey: string;
}

/**
 * Configuration for the CloudFront Function gate, baked into its code at build time. It must
 * stay small: the whole function is limited to 10 KB.
 */
export interface GateConfig {
  /**
   * Folder under which each app lives in its own subfolder. `""` hosts apps at the root
   * (`/customers/`), matching Trailhead's default `appBasePath`.
   */
  appBasePath: string;
  /** Path prefixes served without a login, matched on whole path segments. `/` means the root only. */
  publicPaths: string[];
  /** Same-origin API prefix proxied to the API origin. `""` disables the API surface. */
  apiPrefix: string;
  /** Session keys accepted, current first. A second entry keeps sessions valid during rotation. */
  sessionKeys: string[];
}

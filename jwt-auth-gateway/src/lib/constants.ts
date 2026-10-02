/**
 * Routes, cookie names and timings shared by the CloudFront Function gate and the Lambda@Edge
 * auth routes. Deliberately free of build-time configuration so the CloudFront Function bundle
 * doesn't pull in anything it can't run.
 */

/**
 * Reserved prefix owned by the auth-routes function. The CloudFormation template routes
 * `/_auth/*` to it with its own cache behaviour, so these paths never reach the gate.
 */
export const AUTH_PREFIX = "/_auth";
export const SIGNIN_PATH = `${AUTH_PREFIX}/signin`;
export const CALLBACK_PATH = `${AUTH_PREFIX}/callback`;
export const REFRESH_PATH = `${AUTH_PREFIX}/refresh`;
export const SIGNOUT_PATH = `${AUTH_PREFIX}/signout`;

/**
 * Cookie names. `__Host-` pins a cookie to this exact host over HTTPS with `Path=/`, so a
 * sibling subdomain can't plant or overwrite it. The refresh and sign-in state cookies are
 * scoped to `/_auth` to keep them off every other request, which rules out `__Host-` (it
 * requires `Path=/`), so they get `__Secure-`.
 */
export const COOKIE = {
  idToken: "__Host-id",
  /** HMAC stamp over the id-token, proving the edge verified it. See lib/session.ts. */
  idSignature: "__Host-idsig",
  refreshToken: "__Secure-rt",
  flowState: "__Secure-flow",
} as const;

/** How long the browser keeps the refresh token. Match the app client's refresh token validity. */
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** How long a sign-in may take between leaving for Cognito and returning. */
export const FLOW_STATE_MAX_AGE_SECONDS = 600;

/** Clock skew allowance for `exp` checks. */
export const CLOCK_SKEW_SECONDS = 60;

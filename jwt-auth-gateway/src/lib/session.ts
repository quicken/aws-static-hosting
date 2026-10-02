/**
 * The session stamp: an HMAC over the id-token, set by the auth routes after they have fully
 * verified the token's RS256 signature and claims.
 *
 * CloudFront Functions can only compute hashes and HMACs, not RSA signatures, so the gate that
 * runs on every request can't verify a Cognito token itself. Instead it checks this stamp, which
 * only the edge can produce: "the auth routes verified exactly this token". That, plus the
 * token's own `exp`, is all the per-request check needs, and it runs in well under a millisecond.
 *
 * Everything here must run in the CloudFront Functions runtime: no destructuring, spread,
 * default parameters, for-of, classes or Node-only APIs. The HMAC implementation is passed in,
 * because CloudFront Functions and Node load `crypto` differently.
 */

/** The subset of `crypto.createHmac` both runtimes provide. */
export type HmacFactory = (algorithm: "sha256", key: string) => {
  update(data: string): { digest(encoding: "base64url"): string };
};

export function sessionSignature(createHmac: HmacFactory, key: string, idToken: string): string {
  return createHmac("sha256", key).update(idToken).digest("base64url");
}

/** Compares two strings without an early exit, so response timing leaks nothing about the match. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/** Reads `exp` from a JWT payload without verifying it. Only call on a token whose stamp checked out. */
export function tokenExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64 + "===".slice((base64.length + 3) % 4)));
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch (error) {
    return null;
  }
}

/** True when `signature` stamps `idToken` under any of the accepted keys. */
export function isStamped(createHmac: HmacFactory, keys: string[], idToken: string, signature: string): boolean {
  return keys.some((key) => constantTimeEqual(sessionSignature(createHmac, key, idToken), signature));
}

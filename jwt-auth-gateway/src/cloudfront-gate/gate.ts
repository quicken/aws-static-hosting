/**
 * The per-request gate, run as a CloudFront Function at viewer-request on every behaviour except
 * `/_auth/*`. Kept free of CloudFront Functions globals so it can be unit tested in Node. The
 * thin entry point is src/cloudfront-gate/index.ts.
 *
 * It runs at viewer-request because origin-request only fires on a cache miss. Content cached
 * for one signed-in user would otherwise be served to anyone. It runs as a CloudFront Function
 * rather than Lambda@Edge because it runs on every single request: CloudFront Functions execute
 * at every edge location in under a millisecond, with no cold starts, for a fraction of the cost.
 *
 *   non-normalised path → 400, before anything else is decided
 *   public paths        → no check; deep links still resolve to their app's index.html
 *   API (/api/*)        → same-origin only, then: stamped session → strip the prefix and send
 *                         the id-token as `Authorization: Bearer`, otherwise 401
 *   everything else     → stamped session → resolve deep links to the app's index.html;
 *                         otherwise page loads go to /_auth/signin and assets get a 401
 */
import type { CloudFrontFunctionsEvent } from "aws-lambda";
import type { GateConfig } from "../types/config.js";
import { CLOCK_SKEW_SECONDS, COOKIE, SIGNIN_PATH } from "../lib/constants.js";
import { isApiPath, isNormalisedPath, isPageRequest, isPublicPath, resolveAppShell, stripApiPrefix } from "../lib/routing.js";
import { isStamped, tokenExpiry, type HmacFactory } from "../lib/session.js";

export type GateRequest = CloudFrontFunctionsEvent["request"];
export type GateResponse = NonNullable<CloudFrontFunctionsEvent["response"]>;

/**
 * A generated response the gate returns instead of letting the request reach S3. Always
 * `no-store`: a gate decision is about this one viewer's session and must never be cached.
 */
function status(statusCode: number, statusDescription: string): GateResponse {
  return { statusCode, statusDescription, headers: { "cache-control": { value: "no-store" } }, cookies: {} };
}

/** A 302 the gate returns in place of the request, used to send a page load to the sign-in route. */
function redirect(location: string): GateResponse {
  const response = status(302, "Found");
  response.headers.location = { value: location };
  return response;
}

/**
 * Reassembles the raw query string so the sign-in redirect can carry the user back to the exact
 * URL they asked for.
 *
 * A deep link like `/orders?tab=open&page=2` must survive the round trip through Cognito and come
 * back intact, so the whole query string — repeated keys and all — has to be rebuilt from
 * CloudFront Functions' parsed form and tucked into the `return` parameter.
 */
function queryString(querystring: GateRequest["querystring"]): string {
  const parts: string[] = [];
  Object.keys(querystring).forEach((name) => {
    const entry = querystring[name];
    const values = entry.multiValue ? entry.multiValue.map((item) => item.value) : [entry.value];
    values.forEach((value) => parts.push(value === "" ? name : `${name}=${value}`));
  });
  return parts.join("&");
}

/**
 * The gate's entire trust decision, and the reason this whole function can be a CloudFront
 * Function at all.
 *
 * A CloudFront Function can compute an HMAC but can't verify an RSA signature, so it cannot
 * check a Cognito id-token itself. It doesn't need to: auth-routes already verified the token in
 * full (RS256, issuer, audience, expiry) and left an HMAC stamp over it, keyed with a secret only
 * the edge functions hold. Matching that stamp means "the edge vouched for exactly this token" —
 * cheap enough to run on every request. The stamp says nothing about time, though, so `exp` is
 * re-checked here too; otherwise a stamped token would stay valid forever.
 *
 * @returns the id-token to trust downstream, or null when the session is absent, forged or expired
 */
function sessionToken(request: GateRequest, keys: string[], createHmac: HmacFactory): string | null {
  const token = request.cookies[COOKIE.idToken]?.value;
  const signature = request.cookies[COOKIE.idSignature]?.value;
  if (!token || !signature || !isStamped(createHmac, keys, token, signature)) {
    return null;
  }
  const expiry = tokenExpiry(token);
  return expiry !== null && Date.now() / 1000 <= expiry + CLOCK_SKEW_SECONDS ? token : null;
}

/**
 * Cross-site request forgery guard for the API. The session cookie turns into a Bearer token
 * here, so the API must only honour requests the app itself made. Browsers label every request
 * with `Sec-Fetch-Site`: writes must be `same-origin`, and reads may also be `none` (typed into
 * the address bar). Without that header, `Origin` must match. With neither, only reads are allowed.
 */
function isSameOrigin(request: GateRequest): boolean {
  const safe = request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS";
  const site = request.headers["sec-fetch-site"]?.value;
  if (site) {
    return site === "same-origin" || (safe && site === "none");
  }
  const origin = request.headers.origin?.value;
  if (origin) {
    return origin === `https://${request.headers.host?.value}`;
  }
  return safe;
}

/**
 * The login gate, run on every request that isn't an `/_auth/*` route.
 *
 * This is the one place that decides, for a static origin with no auth of its own, whether a
 * request may see private content — and it has to decide in under a millisecond with only an HMAC
 * to work with. The order matters:
 *
 *  1. A non-normalised path is rejected outright. CloudFront picks the cache behaviour from the
 *     normalised path but hands this function the raw one, so judging `//billing` as if it were
 *     public and then serving it as `/billing` is a real confusion attack — refuse it first.
 *  2. API requests become authenticated calls to the backend: the session cookie (never sent to
 *     the origin) is swapped for an `Authorization: Bearer`, behind a same-origin check so another
 *     site can't ride the user's cookies.
 *  3. Everything else is the SPA: a valid session resolves a deep link to the app's index.html so
 *     the client router can take over; no session sends a page load to sign-in and refuses assets.
 */
export function gate(request: GateRequest, config: GateConfig, createHmac: HmacFactory): GateRequest | GateResponse {
  const uri = request.uri;
  if (!isNormalisedPath(uri)) {
    return status(400, "Bad Request");
  }
  const token = sessionToken(request, config.sessionKeys, createHmac);

  if (isApiPath(uri, config.apiPrefix)) {
    if (!isSameOrigin(request)) {
      return status(403, "Forbidden");
    }
    if (!token) {
      return status(401, "Unauthorized");
    }
    request.uri = stripApiPrefix(uri, config.apiPrefix);
    request.headers.authorization = { value: `Bearer ${token}` };
    // The cookie IS the credential; the API gets a Bearer instead and must never also receive the
    // session cookie, or the token would reach the backend by two paths.
    request.cookies = {};
    return request;
  }

  if (!token && !isPublicPath(uri, config.publicPaths)) {
    if (!isPageRequest(uri)) {
      return status(401, "Unauthorized");
    }
    const query = queryString(request.querystring);
    const returnPath = query ? `${uri}?${query}` : uri;
    return redirect(`${SIGNIN_PATH}?return=${encodeURIComponent(returnPath)}`);
  }

  request.uri = resolveAppShell(uri, config.appBasePath);
  return request;
}

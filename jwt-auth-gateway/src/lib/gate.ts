/**
 * The per-request gate, run as a CloudFront Function at viewer-request on every behaviour except
 * `/_auth/*`. Kept free of CloudFront Functions globals so it can be unit tested in Node. The
 * thin entry point is src/cloudfront/check-auth.ts.
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
import { CLOCK_SKEW_SECONDS, COOKIE, SIGNIN_PATH } from "./constants.js";
import { isApiPath, isNormalisedPath, isPageRequest, isPublicPath, resolveAppShell, stripApiPrefix } from "./routing.js";
import { isStamped, tokenExpiry, type HmacFactory } from "./session.js";

export type GateRequest = CloudFrontFunctionsEvent["request"];
export type GateResponse = NonNullable<CloudFrontFunctionsEvent["response"]>;

function status(statusCode: number, statusDescription: string): GateResponse {
  return { statusCode, statusDescription, headers: { "cache-control": { value: "no-store" } }, cookies: {} };
}

function redirect(location: string): GateResponse {
  const response = status(302, "Found");
  response.headers.location = { value: location };
  return response;
}

/** Rebuilds the query string from CloudFront Functions' parsed form, keeping repeated keys. */
function queryString(querystring: GateRequest["querystring"]): string {
  const parts: string[] = [];
  Object.keys(querystring).forEach((name) => {
    const entry = querystring[name];
    const values = entry.multiValue ? entry.multiValue.map((item) => item.value) : [entry.value];
    values.forEach((value) => parts.push(value === "" ? name : `${name}=${value}`));
  });
  return parts.join("&");
}

/** Returns the id-token when the request carries a stamped, unexpired session, otherwise null. */
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
    // The API has no use for the browser's cookies, and the token shouldn't travel twice.
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

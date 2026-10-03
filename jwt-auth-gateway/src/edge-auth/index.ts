/**
 * VIEWER-REQUEST on `/_auth/*`: the sign-in, callback, refresh and sign-out endpoints.
 *
 * Every route answers with a generated response, so requests never reach the origin. Running at
 * viewer-request gives the function the real `Host` header and the viewer's cookies without
 * forwarding either to S3. Only these rare requests pay for Lambda@Edge; every other request is
 * gated by the CloudFront Function in src/cloudfront-gate/index.ts.
 *
 *   GET  /_auth/signin?return=/path  refresh silently if possible, otherwise start PKCE login
 *   GET  /_auth/callback             redeem the code, set session cookies, return to /path
 *   POST /_auth/refresh              refresh from script: 204 + new cookies, or 401
 *   GET  /_auth/signout              revoke, clear cookies, end the Cognito session
 */
import { createHmac } from "node:crypto";
import type { CloudFrontRequest, CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";
import { config } from "./config.js";
import {
  AUTH_PREFIX,
  CALLBACK_PATH,
  COOKIE,
  FLOW_STATE_MAX_AGE_SECONDS,
  REFRESH_PATH,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SIGNIN_PATH,
  SIGNOUT_PATH,
} from "../lib/constants.js";
import { clearCookie, parseCookies, serializeCookie } from "./cookies.js";
import {
  authorizeUrl,
  createPkce,
  exchangeCode,
  logoutUrl,
  packFlowState,
  randomState,
  refreshTokens,
  revokeRefreshToken,
  unpackFlowState,
  type TokenSet,
} from "./oauth.js";
import { safeReturnPath } from "../lib/routing.js";
import { sessionSignature } from "../lib/session.js";
import { verifyIdToken } from "./verify.js";
import { jsonResponse, noContent, redirect, textResponse } from "./responses.js";

/** Dispatches an `/_auth/*` request to its sign-in, callback, refresh or sign-out route. */
export async function handler(event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> {
  const request = event.Records[0].cf.request;
  const host = request.headers.host?.[0]?.value;
  if (!host) {
    return textResponse("400", "Bad Request", "Missing Host header.");
  }

  switch (request.uri) {
    case SIGNIN_PATH:
      return signIn(request, host);
    case CALLBACK_PATH:
      return callback(request, host);
    case REFRESH_PATH:
      return refresh(request);
    case SIGNOUT_PATH:
      return signOut(request, host);
    default:
      return textResponse("404", "Not Found", "Not Found");
  }
}

/**
 * Cookies for a new or refreshed session: the id-token and its stamp, which tells the gate this
 * token was verified here (see lib/session.ts). Both live exactly as long as the token. The
 * refresh token is only present after a code exchange, or on a refresh when the app client
 * rotates refresh tokens. Callers must have verified the id-token first.
 */
function sessionCookies(tokens: TokenSet): string[] {
  const maxAgeSeconds = tokens.expires_in;
  const cookies = [
    serializeCookie(COOKIE.idToken, tokens.id_token, { maxAgeSeconds }),
    serializeCookie(COOKIE.idSignature, sessionSignature(createHmac, config.sessionKey, tokens.id_token), { maxAgeSeconds }),
  ];
  if (tokens.refresh_token) {
    cookies.push(
      serializeCookie(COOKIE.refreshToken, tokens.refresh_token, {
        path: AUTH_PREFIX,
        maxAgeSeconds: REFRESH_TOKEN_MAX_AGE_SECONDS,
      })
    );
  }
  return cookies;
}

/** Refreshes the session, or returns `null` if the refresh token is expired, revoked or rejected. */
async function refreshSession(refreshToken: string): Promise<string[] | null> {
  try {
    const tokens = await refreshTokens(refreshToken);
    const verified = await verifyIdToken(tokens.id_token);
    if (!verified.ok) {
      console.error("Refreshed id-token failed verification:", verified.reason);
      return null;
    }
    return sessionCookies(tokens);
  } catch (error) {
    console.warn("Token refresh failed:", error);
    return null;
  }
}

/**
 * Where check-auth sends a page load without a valid session. A still-valid refresh token gets
 * the user straight back to where they were, so the hourly id-token expiry is invisible.
 * Otherwise the PKCE sign-in starts.
 */
async function signIn(request: CloudFrontRequest, host: string): Promise<CloudFrontRequestResult> {
  const returnPath = safeReturnPath(new URLSearchParams(request.querystring).get("return"));
  const refreshToken = parseCookies(request.headers)[COOKIE.refreshToken];
  if (refreshToken) {
    const cookies = await refreshSession(refreshToken);
    if (cookies) {
      return redirect(returnPath, cookies);
    }
  }

  const { verifier, challenge } = createPkce();
  const state = randomState();
  const flowCookie = serializeCookie(COOKIE.flowState, packFlowState({ verifier, state, returnPath }), {
    path: AUTH_PREFIX,
    maxAgeSeconds: FLOW_STATE_MAX_AGE_SECONDS,
  });
  return redirect(authorizeUrl(host, challenge, state), [flowCookie, clearCookie(COOKIE.refreshToken, AUTH_PREFIX)]);
}

async function callback(request: CloudFrontRequest, host: string): Promise<CloudFrontRequestResult> {
  const params = new URLSearchParams(request.querystring);
  const oauthError = params.get("error");
  if (oauthError) {
    return textResponse("400", "Bad Request", `Sign-in failed: ${oauthError}`);
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return textResponse("400", "Bad Request", "Missing authorisation code or state.");
  }

  const flow = unpackFlowState(parseCookies(request.headers)[COOKIE.flowState]);
  if (flow?.state !== state) {
    return textResponse("400", "Bad Request", "Sign-in state is missing or doesn't match. Please try again.");
  }

  let tokens: TokenSet;
  try {
    tokens = await exchangeCode(host, code, flow.verifier);
  } catch (error) {
    console.error("Code exchange failed:", error);
    return textResponse("502", "Bad Gateway", "Sign-in failed. Please try again.");
  }

  // Defence in depth: never set a cookie for a token this gateway would reject.
  const verified = await verifyIdToken(tokens.id_token);
  if (!verified.ok) {
    console.error("New id-token failed verification:", verified.reason);
    return textResponse("502", "Bad Gateway", "Sign-in failed. Please try again.");
  }

  return redirect(safeReturnPath(flow.returnPath), [...sessionCookies(tokens), clearCookie(COOKIE.flowState, AUTH_PREFIX)]);
}

/**
 * Lets an app recover from a 401 on an API call without a page reload: POST here, then retry.
 * POST only, so a cross-site page can't trigger it with an image tag. `SameSite=Lax` already
 * keeps the refresh cookie off cross-site POSTs.
 */
async function refresh(request: CloudFrontRequest): Promise<CloudFrontRequestResult> {
  if (request.method !== "POST") {
    const response = textResponse("405", "Method Not Allowed", "Use POST.");
    response.headers!.allow = [{ key: "Allow", value: "POST" }];
    return response;
  }
  const refreshToken = parseCookies(request.headers)[COOKIE.refreshToken];
  const cookies = refreshToken ? await refreshSession(refreshToken) : null;
  if (!cookies) {
    return jsonResponse("401", "Unauthorized", { message: "Session expired", signIn: SIGNIN_PATH }, [
      clearCookie(COOKIE.refreshToken, AUTH_PREFIX),
    ]);
  }
  return noContent(cookies);
}

async function signOut(request: CloudFrontRequest, host: string): Promise<CloudFrontRequestResult> {
  const refreshToken = parseCookies(request.headers)[COOKIE.refreshToken];
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return redirect(logoutUrl(host), [
    clearCookie(COOKIE.idToken),
    clearCookie(COOKIE.idSignature),
    clearCookie(COOKIE.refreshToken, AUTH_PREFIX),
    clearCookie(COOKIE.flowState, AUTH_PREFIX),
  ]);
}

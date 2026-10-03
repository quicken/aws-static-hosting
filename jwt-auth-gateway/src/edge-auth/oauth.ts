/**
 * OAuth 2.0 authorisation code flow with PKCE against the Cognito hosted UI.
 *
 * The app client is a public client: PKCE (RFC 7636) proves that the party redeeming the code
 * is the one that started the sign-in, so there is no client secret to store, rotate or leak.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config, SCOPES } from "./config.js";
import { CALLBACK_PATH } from "../lib/constants.js";

export interface TokenSet {
  id_token: string;
  access_token: string;
  /** Only returned by the code exchange, or by a refresh when the client rotates refresh tokens. */
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Carried across the round trip to Cognito in an HttpOnly cookie, HMAC-signed so a tampered
 * value is rejected. The `state` match in the callback is the primary CSRF control; the
 * signature is defence in depth.
 */
export interface FlowState {
  /** PKCE code verifier. */
  verifier: string;
  /** CSRF state echoed back by Cognito. */
  state: string;
  /** Same-site path to return to once signed in. */
  returnPath: string;
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

const hostedUi = `https://${config.hostedUiDomain}`;

/** Generates a fresh PKCE verifier/challenge pair for one sign-in attempt. */
export function createPkce(): Pkce {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Mints the opaque CSRF `state` value echoed back through the Cognito round trip. */
export function randomState(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The callback URL on the host the user is actually on, so one build serves both the
 * `*.cloudfront.net` domain and a custom domain. Cognito only accepts URLs registered on the
 * app client, so a forged `Host` header gets nowhere.
 */
export function redirectUri(host: string): string {
  return `https://${host}${CALLBACK_PATH}`;
}

/** Builds the Cognito hosted-UI authorisation URL that starts the PKCE login. */
export function authorizeUrl(host: string, challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri(host),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${hostedUi}/oauth2/authorize?${params}`;
}

/** Builds the Cognito hosted-UI logout URL that ends the pool-side session and returns to the site root. */
export function logoutUrl(host: string): string {
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `https://${host}/` });
  return `${hostedUi}/logout?${params}`;
}

async function postForm(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${hostedUi}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

async function requestTokens(body: Record<string, string>): Promise<TokenSet> {
  const response = await postForm("/oauth2/token", body);
  if (!response.ok) {
    // Cognito's error body is a short OAuth error code, never a token, so it is safe to surface.
    const detail = await response.text().catch(() => "");
    throw new Error(`Token endpoint returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as TokenSet;
}

/** Redeems an authorisation code, proving possession with the PKCE verifier. */
export function exchangeCode(host: string, code: string, verifier: string): Promise<TokenSet> {
  return requestTokens({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: redirectUri(host),
    code_verifier: verifier,
  });
}

/** Swaps a refresh token for a fresh id-token without sending the user back to the hosted UI. */
export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return requestTokens({ grant_type: "refresh_token", client_id: config.clientId, refresh_token: refreshToken });
}

/**
 * Revokes a refresh token on sign-out so a copy lifted from the browser stops working too.
 * Best effort: sign-out must still clear the cookies if Cognito is unreachable.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const response = await postForm("/oauth2/revoke", { token: refreshToken, client_id: config.clientId });
    if (!response.ok) {
      console.warn("Refresh token revocation failed:", response.status);
    }
  } catch (error) {
    console.warn("Refresh token revocation failed:", error);
  }
}

function sign(payload: string): string {
  return createHmac("sha256", config.flowKey).update(payload).digest("base64url");
}

/** Encodes the sign-in flow state into one HMAC-signed cookie value for the Cognito round trip. */
export function packFlowState(flow: FlowState): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Decodes a flow-state cookie, returning `null` if its signature fails or the payload is unreadable. */
export function unpackFlowState(raw: string | undefined): FlowState | null {
  const separator = raw?.lastIndexOf(".") ?? -1;
  if (!raw || separator === -1) {
    return null;
  }
  const payload = raw.slice(0, separator);
  const signature = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(sign(payload));
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as FlowState;
  } catch {
    return null;
  }
}

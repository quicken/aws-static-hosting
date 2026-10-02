/**
 * Cognito id-token verification with no dependencies beyond `node:crypto`.
 *
 * The user pool's public signing keys are baked in at build time, so the common case (every
 * request of every signed-in user) verifies locally with no network call on the hot path. When
 * a token carries a key id the bundle doesn't know, which is what a Cognito key rotation looks
 * like, the keys are fetched from the pool's JWKS endpoint. That fetch is throttled per
 * container, so a flood of tokens with made-up key ids can't turn into a flood of fetches.
 */
import { createPublicKey, createVerify, type KeyObject } from "node:crypto";
import type { Jwk, Jwks } from "../types/config.js";
import { config, issuer } from "./config.js";
import { CLOCK_SKEW_SECONDS } from "./constants.js";

export interface IdTokenClaims {
  sub: string;
  email?: string;
  "cognito:groups"?: string[];
  [claim: string]: unknown;
}

export type VerifyResult = { ok: true; claims: IdTokenClaims } | { ok: false; reason: string };

/** Minimum time between JWKS fetches from one container. */
const JWKS_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

const bakedKeys = importKeys(config.jwks.keys);
let fetchedKeys = new Map<string, KeyObject>();
let lastFetch = 0;

function importKeys(keys: Jwk[]): Map<string, KeyObject> {
  return new Map(keys.map((key) => [key.kid, createPublicKey({ key: { ...key }, format: "jwk" })]));
}

async function findKey(kid: string): Promise<KeyObject | undefined> {
  const known = bakedKeys.get(kid) ?? fetchedKeys.get(kid);
  if (known || Date.now() - lastFetch < JWKS_REFETCH_INTERVAL_MS) {
    return known;
  }
  lastFetch = Date.now();
  try {
    const response = await fetch(`${issuer}/.well-known/jwks.json`);
    if (response.ok) {
      fetchedKeys = importKeys(((await response.json()) as Jwks).keys);
    } else {
      console.error("JWKS fetch failed:", response.status);
    }
  } catch (error) {
    console.error("JWKS fetch failed:", error);
  }
  return fetchedKeys.get(kid);
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

/**
 * Verifies a Cognito id-token: RS256 signature first, then expiry, issuer, audience and
 * `token_use`. Claims are only read after the signature checks out. The result never contains
 * the token itself, so it is safe to log.
 */
export async function verifyIdToken(token: string): Promise<VerifyResult> {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return { ok: false, reason: "malformed" };
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments;

  let header: { alg?: string; kid?: string };
  let claims: IdTokenClaims & { iss?: string; aud?: string; exp?: number; token_use?: string };
  try {
    header = decodeSegment(headerSegment);
    claims = decodeSegment(payloadSegment);
  } catch {
    return { ok: false, reason: "undecodable" };
  }

  if (header.alg !== "RS256" || !header.kid) {
    return { ok: false, reason: "header" };
  }
  const key = await findKey(header.kid);
  if (!key) {
    return { ok: false, reason: "unknown-key" };
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerSegment}.${payloadSegment}`);
  if (!verifier.verify(key, Buffer.from(signatureSegment, "base64url"))) {
    return { ok: false, reason: "signature" };
  }

  if (typeof claims.exp !== "number" || Date.now() / 1000 > claims.exp + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "expired" };
  }
  if (claims.iss !== issuer) {
    return { ok: false, reason: "issuer" };
  }
  if (claims.aud !== config.clientId) {
    return { ok: false, reason: "audience" };
  }
  if (claims.token_use !== "id") {
    return { ok: false, reason: "token-use" };
  }
  return { ok: true, claims };
}

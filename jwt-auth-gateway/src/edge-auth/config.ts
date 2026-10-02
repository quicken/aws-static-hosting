/**
 * Runtime view of the build-time configuration for the Lambda@Edge auth routes.
 */
import type { EdgeConfig } from "../types/config.js";

/** Replaced with a literal object by esbuild `define` (build.mjs) or vitest `define` (tests). */
declare const EDGE_CONFIG: EdgeConfig;

export const config: EdgeConfig = EDGE_CONFIG;

/** OIDC issuer: the `iss` claim every id-token must carry. */
export const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;

export const SCOPES = "openid email profile";

#!/usr/bin/env node
/**
 * Builds everything the hosting stack deploys:
 *
 *  - dist/auth-routes.mjs   the src/edge-auth Lambda@Edge handler (the /_auth/* routes)
 *  - dist/check-auth.cf.js   the CloudFront Function gate (src/cloudfront-gate)
 *  - dist/hosting.yaml       cloudformation/hosting.yaml with the gate's code embedded, because
 *                            CloudFormation takes CloudFront Function code inline
 *
 * Lambda@Edge shapes this build:
 *  - No environment variables → configuration from .env is baked into every bundle as the
 *    `EDGE_CONFIG` constant via esbuild `define`.
 *  - No layers and no install step → everything is bundled into one ES module per handler
 *    (`dist/<name>.mjs`; the `.mjs` extension makes Lambda load it as ESM without a package.json).
 *  - The user pool's public signing keys are fetched now and baked in, so verifying a token
 *    needs no network call. Set SKIP_JWKS_BAKE=1 to skip the fetch; the functions then fetch
 *    the keys on first use.
 */
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { bundleGateFunction } from "./tools/bundle-cloudfront.ts";

/**
 * Lambda@Edge handlers to bundle: entry source → output artefact name. The artefact names are a
 * contract with the CloudFormation/OpenTofu templates and deploy.sh, so they stay fixed even
 * though the source now lives in src/edge-auth/. Add a second handler here if one is ever needed.
 */
const EDGE_HANDLERS = [{ entry: "src/edge-auth/index.ts", out: "auth-routes" }];
const OUT_DIR = "dist";
const TEMPLATE = "cloudformation/hosting.yaml";
const CODE_PLACEHOLDER = /^( *)FunctionCode: "\/\/ Replaced by build\.mjs.*"$/m;

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

/** Normalises a path prefix to "/segment" form, or "" when unset. */
function pathPrefix(value) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  return trimmed === "" ? "" : `/${trimmed.replace(/^\/+/, "")}`;
}

async function fetchJwks(region, userPoolId) {
  if (process.env.SKIP_JWKS_BAKE === "1") {
    console.log("SKIP_JWKS_BAKE=1: signing keys will be fetched at runtime.");
    return { keys: [] };
  }
  const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${url}: ${response.status}`);
  }
  const jwks = await response.json();
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error("JWKS has no keys; refusing to bake an empty key set.");
  }
  console.log(`Baked ${jwks.keys.length} signing key(s).`);
  return jwks;
}

/**
 * The key that stamps sessions (see src/lib/session.ts). It must stay the same across builds:
 * CloudFront Functions update within minutes but Lambda@Edge replicas can take 15, so a key
 * that changed with every build would leave the two disagreeing after each deploy. To rotate,
 * move the current key to SESSION_KEY_PREVIOUS, set a new SESSION_KEY and deploy. Remove the
 * previous key on a later deploy.
 */
function sessionKeys() {
  const current = required("SESSION_KEY");
  if (current.length < 32) {
    console.error("SESSION_KEY must be at least 32 characters. Generate one with: openssl rand -base64 32");
    process.exit(1);
  }
  const previous = process.env.SESSION_KEY_PREVIOUS;
  return previous ? [current, previous] : [current];
}

/** Writes the hosting template with the gate's code in place of the FunctionCode placeholder. */
function writeTemplate(gateCode) {
  const template = readFileSync(TEMPLATE, "utf8");
  if (!CODE_PLACEHOLDER.test(template)) {
    throw new Error(`No FunctionCode placeholder found in ${TEMPLATE}.`);
  }
  const embedded = template.replace(CODE_PLACEHOLDER, (_line, indent) => {
    const body = gateCode.trimEnd().split("\n").map((line) => `${indent}  ${line}`).join("\n");
    return `${indent}FunctionCode: |\n${body}`;
  });
  writeFileSync(`${OUT_DIR}/hosting.yaml`, embedded);
}

async function main() {
  const region = required("COGNITO_REGION");
  const userPoolId = required("COGNITO_USER_POOL_ID");
  const keys = sessionKeys();

  const gateConfig = {
    appBasePath: pathPrefix(process.env.APP_BASE_PATH),
    // "/" stays "/" (the site root on its own, not everything beneath it).
    publicPaths: (process.env.PUBLIC_PATHS ?? "/public")
      .split(",")
      .map((path) => (path.trim() === "/" ? "/" : pathPrefix(path)))
      .filter(Boolean),
    // No API origin means no API surface; /api/* is then just another path.
    apiPrefix: process.env.API_ORIGIN_DOMAIN ? pathPrefix(process.env.API_PREFIX ?? "/api") : "",
    sessionKeys: keys,
  };

  const edgeConfig = {
    region,
    userPoolId,
    clientId: required("COGNITO_CLIENT_ID"),
    hostedUiDomain: required("COGNITO_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    jwks: await fetchJwks(region, userPoolId),
    // Fresh per build. Rotating it on deploy only affects a sign-in that is mid-flight, which retries.
    flowKey: randomBytes(32).toString("base64url"),
    sessionKey: keys[0],
  };

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const handler of EDGE_HANDLERS) {
    await build({
      entryPoints: [handler.entry],
      outfile: `${OUT_DIR}/${handler.out}.mjs`,
      bundle: true,
      platform: "node",
      target: "node24",
      format: "esm",
      minify: true,
      define: { EDGE_CONFIG: JSON.stringify(edgeConfig) },
    });
    console.log(`Bundled ${OUT_DIR}/${handler.out}.mjs`);
  }

  const gateCode = await bundleGateFunction(gateConfig);
  writeFileSync(`${OUT_DIR}/check-auth.cf.js`, gateCode);
  console.log(`Bundled ${OUT_DIR}/check-auth.cf.js (${Buffer.byteLength(gateCode)} bytes)`);
  writeTemplate(gateCode);
  console.log(`Wrote ${OUT_DIR}/hosting.yaml`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

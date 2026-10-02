/**
 * CloudFront Function entry point for the gate (see lib/gate.ts).
 *
 * build.mjs bundles this to dist/check-auth.cf.js and rewrites the module syntax into what the
 * CloudFront Functions runtime expects: a top-level `function handler(event)`, with `crypto`
 * loaded through `require`. `GATE_CONFIG` is baked in by esbuild `define`.
 */
import crypto from "crypto";
import type { CloudFrontFunctionsEvent } from "aws-lambda";
import type { GateConfig } from "../types/config.js";
import { gate } from "../lib/gate.js";

declare const GATE_CONFIG: GateConfig;

export function handler(event: CloudFrontFunctionsEvent) {
  return gate(event.request, GATE_CONFIG, crypto.createHmac);
}

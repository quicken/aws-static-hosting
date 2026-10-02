/**
 * Bundles the gate (src/cloudfront-gate/index.ts) into CloudFront Functions source code.
 *
 * The CloudFront Functions runtime is not Node: it has no module syntax, wants a top-level
 * `function handler(event)`, loads `crypto` with `require`, supports only part of ES2015+, and
 * limits a function to 10 KB. esbuild lowers newer syntax (optional chaining, `??`, optional
 * catch bindings, object shorthand) to what the runtime documents, and the module syntax is
 * rewritten here. Only whitespace is minified. Used by build.mjs and by the bundle test, which
 * runs the output in a sandbox exposing only what CloudFront Functions provides.
 */
import { build } from "esbuild";
import type { GateConfig } from "../src/types/config.ts";

/** CloudFront Functions quota; not adjustable. */
export const MAX_FUNCTION_BYTES = 10 * 1024;

export async function bundleGateFunction(config: GateConfig): Promise<string> {
  const result = await build({
    entryPoints: ["src/cloudfront-gate/index.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2018",
    // ES2015+ features the runtime doesn't document. esbuild lowers them, or fails the build if
    // it can't, rather than emitting code CloudFront might reject.
    supported: {
      "object-extensions": false,
      destructuring: false,
      "default-argument": false,
      "for-of": false,
      "object-rest-spread": false,
    },
    external: ["crypto"],
    // Identifiers are kept too: CloudFront looks up `handler` by name.
    minifyWhitespace: true,
    legalComments: "none",
    define: { GATE_CONFIG: JSON.stringify(config) },
  });

  const code = result.outputFiles[0].text
    .replace(/import\s*(\w+)\s*from\s*"crypto";?/, 'var $1=require("crypto");')
    .replace(/export\s*\{\s*handler\s*\};?\s*$/, "");

  if (/\bimport\s|\bexport\s*\{/.test(code) || !/function handler\(/.test(code)) {
    throw new Error("Gate bundle still contains module syntax or lacks a top-level handler.");
  }
  const bytes = Buffer.byteLength(code);
  if (bytes > MAX_FUNCTION_BYTES) {
    throw new Error(`Gate bundle is ${bytes} bytes; CloudFront Functions allows ${MAX_FUNCTION_BYTES}.`);
  }
  return code;
}

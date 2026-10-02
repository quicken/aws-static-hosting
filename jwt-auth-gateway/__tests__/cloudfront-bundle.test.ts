import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { bundleGateFunction } from '../tools/bundle-cloudfront.js';
import type { GateConfig } from '../src/types/config.js';
import { createFunctionEvent, signToken } from './helpers.js';

const config: GateConfig = { appBasePath: '', publicPaths: ['/', '/docs'], apiPrefix: '/api', sessionKeys: ['bundle-key'] };

let code: string;
let handler: (event: unknown) => { uri?: string; statusCode?: number; headers?: Record<string, { value: string }> };

beforeAll(async () => {
  code = await bundleGateFunction(config);
  // Only what the CloudFront Functions runtime offers: require('crypto'), atob, console.
  const sandbox = vm.createContext({
    require: (name: string) => {
      if (name !== 'crypto') {
        throw new Error(`CloudFront Functions has no module "${name}"`);
      }
      return { createHmac: crypto.createHmac };
    },
    atob,
    console,
  });
  vm.runInContext(code, sandbox);
  handler = sandbox.handler;
});

describe('CloudFront Function bundle', () => {
  it('fits the 10 KB limit and has no syntax the runtime lacks', () => {
    expect(Buffer.byteLength(code)).toBeLessThan(10 * 1024);
    expect(code).not.toMatch(/\?\.|\?\?|\bclass\s|\.\.\.[\w[{(]|for\s*\(\s*(const|let|var)\s+[\w$]+\s+of\s|catch\s*\{/);
  });

  it('exposes a top-level handler that gates, rewrites and stamps like the library', () => {
    const token = signToken();
    const stamp = crypto.createHmac('sha256', 'bundle-key').update(token).digest('base64url');

    expect(handler(createFunctionEvent('/billing/7', { cookies: { '__Host-id': token, '__Host-idsig': stamp } })).uri).toBe('/billing/index.html');
    expect(handler(createFunctionEvent('/billing/7')).statusCode).toBe(302);
    expect(handler(createFunctionEvent('//billing')).statusCode).toBe(400);
    expect(handler(createFunctionEvent('/docs/intro')).uri).toBe('/docs/index.html');
    expect(handler(createFunctionEvent('/api/x', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })).statusCode).toBe(403);
  });
});

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { gate, type GateRequest, type GateResponse } from '../src/cloudfront-gate/gate.js';
import type { GateConfig } from '../src/types/config.js';
import { createFunctionEvent, signToken, HOST, type FunctionEventOptions } from './helpers.js';

const config: GateConfig = {
  appBasePath: '',
  publicPaths: ['/', '/index.html', '/shell.js', '/shell.json', '/webawesome', '/docs'],
  apiPrefix: '/api',
  sessionKeys: ['current-key', 'previous-key'],
};

const stamp = (token: string, key = 'current-key') => createHmac('sha256', key).update(token).digest('base64url');

function session(token = signToken(), key?: string): Record<string, string> {
  return { '__Host-id': token, '__Host-idsig': stamp(token, key) };
}

function run(uri: string, options: FunctionEventOptions = {}) {
  return gate(createFunctionEvent(uri, options).request, config, createHmac);
}

const asRequest = (result: GateRequest | GateResponse) => result as GateRequest;
const asResponse = (result: GateRequest | GateResponse) => result as GateResponse;

describe('gate: path normalisation', () => {
  it.each(['//billing', '//billing/app.js', '/docs/../billing/app.js', '/docs/%2e%2e/billing/app.js', '/docs\\..\\billing'])(
    'refuses %s before any other decision, even for a signed-in user',
    (uri) => {
      expect(asResponse(run(uri, { cookies: session() })).statusCode).toBe(400);
    }
  );
});

describe('gate: sessions', () => {
  it('serves a stamped session and resolves the deep link', () => {
    expect(asRequest(run('/billing/invoices/7', { cookies: session() })).uri).toBe('/billing/index.html');
  });

  it('accepts a stamp made with the previous key during rotation', () => {
    expect(asRequest(run('/billing', { cookies: session(signToken(), 'previous-key') })).uri).toBe('/billing/index.html');
  });

  it.each([
    ['no cookies', {}],
    ['a token without a stamp', { '__Host-id': signToken() }],
    ['a stamp for a different token', { '__Host-id': signToken({ sub: 'someone-else' }), '__Host-idsig': stamp(signToken()) }],
    ['a stamp made with an unknown key', session(signToken(), 'attacker-key')],
    ['an expired token', session(signToken({ exp: Math.floor(Date.now() / 1000) - 3600 }))],
  ])('treats %s as signed out', (_label, cookies) => {
    const result = asResponse(run('/billing', { cookies }));
    expect(result.statusCode).toBe(302);
  });

  it('sends a page load to sign-in, keeping the path and query', () => {
    const result = asResponse(run('/billing/invoices/7', { querystring: { tab: 'paid' } }));
    expect(result.headers.location.value).toBe('/_auth/signin?return=%2Fbilling%2Finvoices%2F7%3Ftab%3Dpaid');
  });

  it('answers an anonymous asset request with 401', () => {
    expect(asResponse(run('/billing/app.js')).statusCode).toBe(401);
  });
});

describe('gate: public paths', () => {
  it('serves the public shell, its assets and the public app without a session', () => {
    expect(asRequest(run('/')).uri).toBe('/index.html');
    expect(asRequest(run('/shell.json')).uri).toBe('/shell.json');
    expect(asRequest(run('/docs/getting-started')).uri).toBe('/docs/index.html');
  });

  it('keeps members-only apps behind the login even with a public root', () => {
    expect(asResponse(run('/billing')).statusCode).toBe(302);
  });
});

describe('gate: API', () => {
  const sameOrigin = { 'sec-fetch-site': 'same-origin' };

  it('forwards a same-origin call with a Bearer header and no cookies', () => {
    const token = signToken();
    const result = asRequest(run('/api/invoices/7', { method: 'POST', cookies: { ...session(token), other: '1' }, headers: sameOrigin }));
    expect(result.uri).toBe('/invoices/7');
    expect(result.headers.authorization).toEqual({ value: `Bearer ${token}` });
    expect(result.cookies).toEqual({});
  });

  it('answers an unsigned-in call with 401', () => {
    expect(asResponse(run('/api/invoices', { headers: sameOrigin })).statusCode).toBe(401);
  });

  it.each([
    ['a cross-site POST', 'POST', { 'sec-fetch-site': 'cross-site' }],
    ['a same-site POST from a sibling subdomain', 'POST', { 'sec-fetch-site': 'same-site' }],
    ['a cross-site GET navigation', 'GET', { 'sec-fetch-site': 'cross-site' }],
    ['a POST from a foreign Origin', 'POST', { origin: 'https://evil.example' }],
    ['a POST with no provenance headers', 'POST', {}],
  ])('refuses %s with 403, even with a valid session', (_label, method, headers) => {
    expect(asResponse(run('/api/invoices', { method, cookies: session(), headers })).statusCode).toBe(403);
  });

  it.each([
    ['a GET typed into the address bar', 'GET', { 'sec-fetch-site': 'none' }],
    ['a POST with a matching Origin and no Sec-Fetch-Site', 'POST', { origin: `https://${HOST}` }],
    ['a GET with no provenance headers', 'GET', {}],
  ])('allows %s', (_label, method, headers) => {
    expect(asRequest(run('/api/invoices', { method, cookies: session(), headers })).uri).toBe('/invoices');
  });
});

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { authorizeUrl, createPkce, packFlowState, unpackFlowState } from '../src/edge-auth/oauth.js';
import { HOST, HOSTED_UI } from './helpers.js';

describe('createPkce', () => {
  it('derives the S256 challenge from the verifier', () => {
    const { verifier, challenge } = createPkce();
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });
});

describe('authorizeUrl', () => {
  it('asks for a code with PKCE and a callback on the request host', () => {
    const url = new URL(authorizeUrl(HOST, 'challenge', 'state'));
    expect(`${url.origin}${url.pathname}`).toBe(`${HOSTED_UI}/oauth2/authorize`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'test-client-id',
      redirect_uri: `https://${HOST}/_auth/callback`,
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state',
    });
  });
});

describe('flow state', () => {
  const flow = { verifier: 'v', state: 's', returnPath: '/customers/42' };

  it('round-trips', () => {
    expect(unpackFlowState(packFlowState(flow))).toEqual(flow);
  });

  it('rejects a tampered payload', () => {
    const [, signature] = packFlowState(flow).split('.');
    const tampered = Buffer.from(JSON.stringify({ ...flow, returnPath: '//evil.example' })).toString('base64url');
    expect(unpackFlowState(`${tampered}.${signature}`)).toBeNull();
  });

  it('rejects missing or unsigned values', () => {
    expect(unpackFlowState(undefined)).toBeNull();
    expect(unpackFlowState('no-signature')).toBeNull();
  });
});

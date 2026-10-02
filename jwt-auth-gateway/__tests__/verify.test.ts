import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signToken, stubCognito, ISSUER } from './helpers.js';

/** Fresh module per test so the per-container JWKS cache and fetch throttle start empty. */
async function loadVerify() {
  vi.resetModules();
  return import('../src/lib/verify.js');
}

describe('verifyIdToken', () => {
  beforeEach(() => {
    stubCognito();
  });

  it('accepts a valid id-token, fetching the unknown signing key once', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { verifyIdToken } = await loadVerify();

    const first = await verifyIdToken(signToken({ email: 'marcel@example.com' }));
    const second = await verifyIdToken(signToken());

    expect(first).toMatchObject({ ok: true, claims: { sub: 'user-1', email: 'marcel@example.com' } });
    expect(second.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['expired', { exp: undefined }],
    ['issuer', { iss: `${ISSUER}-other` }],
    ['audience', { aud: 'another-client' }],
    ['token-use', { token_use: 'access' }],
  ])('rejects with %s for claims %o', async (reason, claims) => {
    const { verifyIdToken } = await loadVerify();
    expect(await verifyIdToken(signToken(claims))).toEqual({ ok: false, reason });
  });

  it('rejects a token whose payload was altered after signing', async () => {
    const { verifyIdToken } = await loadVerify();
    const [head, , signature] = signToken().split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', iss: ISSUER, aud: 'test-client-id', token_use: 'id', exp: 9999999999 })).toString('base64url');
    expect(await verifyIdToken(`${head}.${forged}.${signature}`)).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects alg=none and malformed tokens', async () => {
    const { verifyIdToken } = await loadVerify();
    expect(await verifyIdToken(signToken({}, { alg: 'none' }))).toEqual({ ok: false, reason: 'header' });
    expect(await verifyIdToken('not-a-jwt')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('throttles JWKS fetches for unknown key ids', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { verifyIdToken } = await loadVerify();

    await verifyIdToken(signToken({}, { kid: 'made-up-1' }));
    const result = await verifyIdToken(signToken({}, { kid: 'made-up-2' }));

    expect(result).toEqual({ ok: false, reason: 'unknown-key' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

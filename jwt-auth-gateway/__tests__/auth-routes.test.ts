import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { handler } from '../src/edge-auth/index.js';
import { packFlowState } from '../src/edge-auth/oauth.js';
import { createEvent, header, setCookies, signToken, stubCognito, HOST, HOSTED_UI } from './helpers.js';

const tokens = () => ({ id_token: signToken(), access_token: 'access', refresh_token: 'refresh-2', expires_in: 3600, token_type: 'Bearer' });

describe('/_auth/signin', () => {
  it('starts a PKCE login when there is no refresh token', async () => {
    stubCognito();
    const result = await handler(createEvent('/_auth/signin', { querystring: 'return=%2Fcustomers%2F42' }));

    const location = new URL(header(result, 'location')!);
    expect(`${location.origin}${location.pathname}`).toBe(`${HOSTED_UI}/oauth2/authorize`);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(setCookies(result).some((cookie) => cookie.startsWith('__Secure-flow=') && cookie.includes('Path=/_auth'))).toBe(true);
  });

  it('refreshes silently and returns to the page when the refresh token works', async () => {
    const calls = stubCognito(tokens());
    const result = await handler(createEvent('/_auth/signin', { querystring: 'return=%2Fcustomers%2F42', cookies: '__Secure-rt=refresh-1' }));

    expect(header(result, 'location')).toBe('/customers/42');
    expect(calls[0].body.get('grant_type')).toBe('refresh_token');
    expect(setCookies(result).some((cookie) => cookie.startsWith('__Host-id='))).toBe(true);
  });

  it('falls back to login when the refresh token is rejected', async () => {
    stubCognito(400);
    const result = await handler(createEvent('/_auth/signin', { cookies: '__Secure-rt=revoked' }));
    expect(header(result, 'location')).toContain('/oauth2/authorize');
  });

  // The return= param is attacker-controlled, so every hostile shape safeReturnPath guards must be
  // proven to collapse to "/" at THIS boundary — not only in the isolated unit test — because this
  // is the seam where return= actually becomes a Location header.
  it.each([
    ['protocol-relative //host', 'return=%2F%2Fevil.example'],
    ['backslash bypass /\\host', 'return=%2F%5Cevil.example'],
    ['CRLF header injection', 'return=%2Fok%0d%0aSet-Cookie:%20x'],
  ])('never redirects off-site via %s', async (_label, querystring) => {
    stubCognito(tokens());
    const result = await handler(createEvent('/_auth/signin', { querystring, cookies: '__Secure-rt=refresh-1' }));
    expect(header(result, 'location')).toBe('/');
  });
});

describe('/_auth/callback', () => {
  const flowCookie = `__Secure-flow=${packFlowState({ verifier: 'verifier', state: 'state-1', returnPath: '/customers/42' })}`;

  it('redeems the code with the PKCE verifier and sets HttpOnly session cookies', async () => {
    const calls = stubCognito(tokens());
    const result = await handler(createEvent('/_auth/callback', { querystring: 'code=abc&state=state-1', cookies: flowCookie }));

    expect(header(result, 'location')).toBe('/customers/42');
    expect(Object.fromEntries(calls[0].body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'abc',
      code_verifier: 'verifier',
      redirect_uri: `https://${HOST}/_auth/callback`,
    });
    const cookies = setCookies(result);
    expect(cookies.find((cookie) => cookie.startsWith('__Host-id='))).toContain('HttpOnly');
    // The stamp the gate checks: an HMAC over exactly this id-token under the session key.
    const idToken = decodeURIComponent(cookies.find((cookie) => cookie.startsWith('__Host-id='))!.split(';')[0].split('=')[1]);
    const stamp = cookies.find((cookie) => cookie.startsWith('__Host-idsig='))!.split(';')[0].split('=')[1];
    expect(stamp).toBe(createHmac('sha256', 'test-only-session-key').update(idToken).digest('base64url'));
    expect(cookies.find((cookie) => cookie.startsWith('__Secure-rt='))).toContain('Path=/_auth');
  });

  it('rejects a state mismatch without calling Cognito', async () => {
    const calls = stubCognito(tokens());
    const result = await handler(createEvent('/_auth/callback', { querystring: 'code=abc&state=forged', cookies: flowCookie }));
    expect(result).toMatchObject({ status: '400' });
    expect(calls).toHaveLength(0);
  });

  it('refuses to set a cookie for a token that fails verification', async () => {
    stubCognito({ ...tokens(), id_token: signToken({ aud: 'another-client' }) });
    const result = await handler(createEvent('/_auth/callback', { querystring: 'code=abc&state=state-1', cookies: flowCookie }));
    expect(result).toMatchObject({ status: '502' });
    expect(setCookies(result)).toHaveLength(0);
  });
});

describe('/_auth/refresh', () => {
  it('only accepts POST', async () => {
    expect(await handler(createEvent('/_auth/refresh'))).toMatchObject({ status: '405' });
  });

  it('returns 204 with a new id-token cookie', async () => {
    stubCognito(tokens());
    const result = await handler(createEvent('/_auth/refresh', { method: 'POST', cookies: '__Secure-rt=refresh-1' }));
    expect(result).toMatchObject({ status: '204' });
    expect(setCookies(result).some((cookie) => cookie.startsWith('__Host-id='))).toBe(true);
  });

  it('returns 401 when there is nothing to refresh', async () => {
    stubCognito();
    expect(await handler(createEvent('/_auth/refresh', { method: 'POST' }))).toMatchObject({ status: '401' });
  });
});

describe('/_auth/signout', () => {
  it('revokes the refresh token, clears every cookie and ends the Cognito session', async () => {
    const calls = stubCognito({});
    const result = await handler(createEvent('/_auth/signout', { cookies: '__Secure-rt=refresh-1' }));

    expect(calls[0].url).toBe(`${HOSTED_UI}/oauth2/revoke`);
    expect(header(result, 'location')).toBe(`${HOSTED_UI}/logout?client_id=test-client-id&logout_uri=https%3A%2F%2F${HOST}%2F`);
    expect(setCookies(result).every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect(setCookies(result).map((cookie) => cookie.split('=')[0])).toEqual(['__Host-id', '__Host-idsig', '__Secure-rt', '__Secure-flow']);
  });
});

it('404s unknown /_auth paths', async () => {
  expect(await handler(createEvent('/_auth/nope'))).toMatchObject({ status: '404' });
});

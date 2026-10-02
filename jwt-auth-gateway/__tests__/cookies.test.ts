import { describe, it, expect } from 'vitest';
import { clearCookie, parseCookies, serializeCookie } from '../src/lib/cookies.js';

describe('parseCookies', () => {
  it('reads every Cookie header', () => {
    const cookies = parseCookies({
      cookie: [
        { key: 'Cookie', value: 'a=1; b=two%20words' },
        { key: 'Cookie', value: 'c=3' },
      ],
    });
    expect(cookies).toEqual({ a: '1', b: 'two words', c: '3' });
  });

  it('skips malformed values instead of throwing', () => {
    expect(parseCookies({ cookie: [{ key: 'Cookie', value: 'bad=%E0%A4%A; good=1' }] })).toEqual({ good: '1' });
  });

  it('returns an empty map without a Cookie header', () => {
    expect(parseCookies({})).toEqual({});
  });
});

describe('serializeCookie', () => {
  it('is always Secure and HttpOnly', () => {
    expect(serializeCookie('__Host-id', 'token', { maxAgeSeconds: 3600 })).toBe('__Host-id=token; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600');
  });

  it('clears a cookie on the path it was set with', () => {
    expect(clearCookie('__Secure-rt', '/_auth')).toBe('__Secure-rt=; Path=/_auth; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
  });
});

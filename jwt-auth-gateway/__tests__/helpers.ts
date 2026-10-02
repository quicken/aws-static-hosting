import { createSign, generateKeyPairSync } from 'node:crypto';
import type { CloudFrontFunctionsEvent, CloudFrontRequest, CloudFrontRequestEvent } from 'aws-lambda';

export const CLIENT_ID = 'test-client-id';
export const ISSUER = 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_TestPool';
export const HOSTED_UI = 'https://test-auth.auth.ap-southeast-2.amazoncognito.com';
export const HOST = 'apps.example.com';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const KID = 'test-kid';
export const JWKS = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] };

/** Signs an id-token with the test key. Override claims or header fields to build bad tokens. */
export function signToken(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'RS256', kid: KID, ...header });
  const body = encode({ sub: 'user-1', iss: ISSUER, aud: CLIENT_ID, token_use: 'id', exp: now + 3600, ...claims });
  const signature = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `${head}.${body}.${signature}`;
}

export interface FetchCall {
  url: string;
  body: URLSearchParams;
}

/**
 * Stubs `fetch` for Cognito: serves the JWKS, and answers the token endpoint with `tokenResponse`
 * (a status code to simulate a failure). Returns the recorded POST calls.
 */
export function stubCognito(tokenResponse: object | number = {}): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${ISSUER}/.well-known/jwks.json`) {
      return Response.json(JWKS);
    }
    calls.push({ url, body: new URLSearchParams(String(init?.body ?? '')) });
    if (typeof tokenResponse === 'number') {
      return new Response('{"error":"invalid_grant"}', { status: tokenResponse });
    }
    return Response.json(tokenResponse);
  }) as typeof fetch;
  return calls;
}

export function createEvent(uri: string, options: { cookies?: string; querystring?: string; method?: string } = {}): CloudFrontRequestEvent {
  const request: CloudFrontRequest = {
    clientIp: '192.0.2.1',
    method: options.method ?? 'GET',
    uri,
    querystring: options.querystring ?? '',
    headers: {
      host: [{ key: 'Host', value: HOST }],
      ...(options.cookies ? { cookie: [{ key: 'Cookie', value: options.cookies }] } : {}),
    },
  };
  return {
    Records: [
      {
        cf: {
          config: { distributionDomainName: HOST, distributionId: 'EXAMPLE', eventType: 'viewer-request', requestId: 'test' },
          request,
        },
      },
    ],
  };
}

/** Pulls the Set-Cookie values out of a generated response. */
export function setCookies(result: unknown): string[] {
  const headers = (result as { headers?: Record<string, Array<{ value: string }>> }).headers ?? {};
  return (headers['set-cookie'] ?? []).map((header) => header.value);
}

export function header(result: unknown, name: string): string | undefined {
  return (result as { headers?: Record<string, Array<{ value: string }>> }).headers?.[name]?.[0]?.value;
}

export interface FunctionEventOptions {
  method?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  querystring?: Record<string, string>;
}

/** Builds a CloudFront Functions viewer-request event, the shape the gate receives. */
export function createFunctionEvent(uri: string, options: FunctionEventOptions = {}): CloudFrontFunctionsEvent {
  const wrap = (values: Record<string, string> = {}) =>
    Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }]));
  return {
    version: '1.0',
    context: { distributionDomainName: HOST, distributionId: 'EXAMPLE', eventType: 'viewer-request', requestId: 'test' },
    viewer: { ip: '192.0.2.1' },
    request: {
      method: options.method ?? 'GET',
      uri,
      querystring: wrap(options.querystring),
      headers: wrap({ host: HOST, ...options.headers }),
      cookies: wrap(options.cookies),
    },
  } as CloudFrontFunctionsEvent;
}

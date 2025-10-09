import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudFrontRequestEvent, CloudFrontRequest } from 'aws-lambda';

// Mock the auth module
vi.mock('../src/lib/auth', () => ({
  isAuthenticated: vi.fn()
}));

describe('Lambda@Edge Handler', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    delete process.env.SPA_BASE_PATH; // Reset for each test
    vi.clearAllMocks();
  });

  const createEvent = (uri: string, cookies?: string): CloudFrontRequestEvent => ({
    Records: [{
      cf: {
        config: {
          distributionDomainName: 'example.cloudfront.net',
          distributionId: 'EXAMPLE',
          eventType: 'viewer-request',
          requestId: 'test-request-id'
        },
        request: {
          clientIp: '192.0.2.1',
          method: 'GET',
          uri,
          querystring: '',
          headers: cookies ? {
            cookie: [{ key: 'Cookie', value: cookies }]
          } : {},
          origin: {
            s3: {
              domainName: 'example.s3.amazonaws.com',
              region: 'us-east-1',
              authMethod: 'none',
              path: ''
            }
          }
        } as CloudFrontRequest
      }
    }]
  });

  it('should redirect unauthenticated SPA requests to auth with return URL', async () => {
    process.env.SPA_BASE_PATH = 'apps';
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/apps/dashboard');
    const result = await handler(event);

    expect(result).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: '/auth/?return_url=%2Fapps%2Fdashboard'
        }]
      }
    });
  });

  it('should return 404 for unauthenticated non-HTML protected requests', async () => {
    process.env.SPA_BASE_PATH = 'apps';
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/apps/api/data.json');
    const result = await handler(event);

    expect(result).toEqual({
      status: '404',
      statusDescription: 'Not Found',
      headers: {
        'content-type': [{
          key: 'Content-Type',
          value: 'text/plain'
        }]
      },
      body: 'Not Found'
    });
  });

  it('should return request for root path after rewrite to /public/index.html', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/');
    const result = await handler(event);

    // Root gets rewritten to /public/index.html, which is now public per isPublicPath
    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/public/index.html');
  });

  it('should return request for auth routes', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/auth/callback');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/auth/index.html');
  });

  it('should rewrite protected SPA routes when authenticated', async () => {
    process.env.SPA_BASE_PATH = 'apps';
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/apps/dashboard');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/apps/dashboard/index.html');
  });

  it('should rewrite to base SPA when only base path is accessed', async () => {
    process.env.SPA_BASE_PATH = 'apps';
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/apps');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/apps/index.html');
  });

  it('should pass through asset files without rewriting', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/assets/main.js');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/assets/main.js');
  });

  it('should return request for direct HTML file requests', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/index.html');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
    expect(event.Records[0].cf.request.uri).toBe('/index.html');
  });

  it('should return 500 on internal errors', async () => {
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockRejectedValue(new Error('Test error'));
    
    const { handler } = await import('../src/index');
    const event = createEvent('/apps/dashboard');
    const result = await handler(event);

    expect(result).toEqual({
      status: '500',
      statusDescription: 'Internal Server Error',
      headers: {
        'content-type': [{
          key: 'Content-Type',
          value: 'text/plain'
        }]
      },
      bodyEncoding: 'text',
      body: 'Internal Server Error'
    });
  });

  it('should handle non-viewer-request events', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/test');
    event.Records[0].cf.config.eventType = 'origin-response';
    
    const result = await handler(event);
    expect(result).toEqual(event.Records[0].cf.request);
  });
});

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

  it('should redirect unauthenticated requests to login', async () => {
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/dashboard');
    const result = await handler(event);

    expect(result).toEqual({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: '/public/login'
        }]
      }
    });
  });

  it('should continue to origin for authenticated requests', async () => {
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    
    const { handler } = await import('../src/index');
    const event = createEvent('/', 'cognito-token=valid-token');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
  });

  it('should continue to origin for public requests without authentication', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/public/login');
    const result = await handler(event);

    expect(result).toEqual(event.Records[0].cf.request);
  });

  it('should return 404 for asset requests', async () => {
    const { handler } = await import('../src/index');
    const event = createEvent('/assets/main.js');
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
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the auth module
vi.mock('../src/lib/auth', () => ({
  isAuthenticated: vi.fn()
}));

describe('Lambda Handler', () => {
  beforeEach(() => {
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    vi.clearAllMocks();
  });

  const createEvent = (path: string, cookies?: string): APIGatewayProxyEvent => ({
    path,
    httpMethod: 'GET',
    headers: cookies ? { Cookie: cookies } : {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    body: null,
    isBase64Encoded: false
  });

  it('should redirect unauthenticated requests to login', async () => {
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    
    const { handler } = await import('../src/handler');
    const event = createEvent('/');
    const result = await handler(event);

    expect(result.statusCode).toBe(302);
    expect(result.headers.Location).toBe('/public/login');
  });

  it('should authorize protected requests with valid token', async () => {
    const { isAuthenticated } = await import('../src/lib/auth');
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    
    const { handler } = await import('../src/handler');
    const event = createEvent('/', 'cognito-token=valid-token');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('');
  });

  it('should authorize public requests without authentication', async () => {
    const { handler } = await import('../src/handler');
    const event = createEvent('/public/login');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('');
  });

  it('should return 404 for asset requests', async () => {
    const { handler } = await import('../src/handler');
    const event = createEvent('/assets/main.js');
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(result.body).toBe('Not Found');
  });
});

# Unit Test Coverage - Critical Business Logic

## Overview
Unit tests focus exclusively on business logic functions that are critical for security and functionality. UI components are not unit tested as they should be covered by integration/E2E tests.

## Test Coverage Summary

### ✅ Security-Critical Business Logic (100% Coverage)

#### 1. Return URL Validation (`authValidation.test.ts`)
**Purpose:** Prevent open redirect attacks
**Coverage:** 10 test cases
- ✅ Valid relative paths (`/dashboard`, `/app1/users`)
- ✅ Valid same-origin absolute URLs
- ✅ Reject protocol-relative URLs (`//evil.com`)
- ✅ Reject javascript: and data: URLs
- ✅ Reject different origin URLs
- ✅ Handle malformed URLs
- ✅ Edge cases (fragments, query params, encoding)

#### 2. Cookie Security (`cookieUtils.test.ts`)
**Purpose:** Ensure secure JWT cookie setting for Lambda@Edge
**Coverage:** 10 test cases
- ✅ Correct cookie name (`cognito-token`)
- ✅ All security attributes (Secure, SameSite=Strict, Path=/, Max-Age=3600)
- ✅ Special character handling in tokens
- ✅ Proper cookie format validation
- ✅ Security attribute enforcement

#### 3. Cross-App Authentication Client (`authClient.test.ts`)
**Purpose:** Secure communication between apps and auth service
**Coverage:** 12 test cases
- ✅ Client instantiation with timeouts
- ✅ Auth check via iframe communication
- ✅ Login flow via popup
- ✅ Origin validation for postMessage security
- ✅ Timeout handling
- ✅ Error handling and cleanup
- ✅ Popup management

### ✅ Utility Functions (`utils.test.ts`)
**Purpose:** Basic utility function validation
**Coverage:** 2 test cases
- ✅ Number addition
- ✅ Service name formatting

## Test Statistics
- **Total Tests:** 34
- **Test Files:** 4
- **Business Logic Coverage:** 100%
- **Security-Critical Functions:** 100% covered

## What's NOT Unit Tested (By Design)
- **React Components:** UI logic should be tested via integration/E2E tests
- **OIDC Integration:** External library, covered by integration tests
- **DOM Manipulation:** Browser-specific, covered by E2E tests
- **Network Requests:** External dependencies, mocked in integration tests

## Critical Business Logic Functions Tested

### Security Functions
1. `validateReturnUrl()` - Open redirect protection
2. `setSecureJWTCookie()` - Secure cookie setting
3. `AuthClient.checkAuth()` - Cross-origin auth validation
4. `AuthClient.login()` - Secure popup authentication

### Integration Functions
1. `AuthClient` constructor - Configuration validation
2. `AuthClient.logout()` - Secure logout flow
3. `createAuthClient()` - Factory function

## Running Tests

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage
```

## Test Philosophy
- **Unit tests** for pure business logic functions
- **Integration tests** for component interactions
- **E2E tests** for complete user flows
- **Security-first** approach to test coverage

This approach ensures critical security and business logic is thoroughly tested while avoiding brittle UI tests.

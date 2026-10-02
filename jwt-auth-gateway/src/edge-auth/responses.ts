/**
 * Responses generated at the edge. None of them may be cached: they carry cookies or depend on
 * who is asking.
 */
import type { CloudFrontHeaders, CloudFrontResultResponse } from "aws-lambda";

function baseHeaders(contentType: string | undefined, setCookies: string[]): CloudFrontHeaders {
  const headers: CloudFrontHeaders = {
    "cache-control": [{ key: "Cache-Control", value: "no-store" }],
  };
  if (contentType) {
    headers["content-type"] = [{ key: "Content-Type", value: contentType }];
  }
  if (setCookies.length > 0) {
    headers["set-cookie"] = setCookies.map((value) => ({ key: "Set-Cookie", value }));
  }
  return headers;
}

/**
 * A 302 to `location`, with no body.
 *
 * The workhorse of the auth flow: hands the browser off to the Cognito hosted UI, back to the
 * callback, or on to the originally-requested page once signed in. Any `location` taken from the
 * request must already have passed `safeReturnPath` — this builder does not re-check it.
 *
 * @param location - Absolute URL (to Cognito) or same-site path (back into the app)
 * @param setCookies - `Set-Cookie` values to apply alongside the redirect, e.g. session or flow cookies
 */
export function redirect(location: string, setCookies: string[] = []): CloudFrontResultResponse {
  const headers = baseHeaders(undefined, setCookies);
  headers.location = [{ key: "Location", value: location }];
  return { status: "302", statusDescription: "Found", headers };
}

/**
 * A plain-text response, used for the flow's error and method-not-allowed cases.
 *
 * Text, not HTML, so a value echoed into the body (e.g. a Cognito OAuth error code) can never be
 * interpreted as markup by the browser.
 *
 * @param status - HTTP status as a string, e.g. `"400"` (CloudFront's response shape wants a string)
 * @param body - Shown to the user as-is; keep it a safe, generic message, never a token or secret
 */
export function textResponse(status: string, statusDescription: string, body: string, setCookies: string[] = []): CloudFrontResultResponse {
  return { status, statusDescription, headers: baseHeaders("text/plain; charset=utf-8", setCookies), body };
}

/**
 * A JSON response, used by `/_auth/refresh` so a script can read the outcome and retry.
 *
 * @param body - Serialised to JSON; must never contain a token or cookie value (the response body is readable by script)
 */
export function jsonResponse(status: string, statusDescription: string, body: object, setCookies: string[] = []): CloudFrontResultResponse {
  return { status, statusDescription, headers: baseHeaders("application/json; charset=utf-8", setCookies), body: JSON.stringify(body) };
}

/**
 * A 204 carrying only cookies — the success case for `/_auth/refresh`, which rotates the session
 * cookies without returning any body for the calling script to read.
 */
export function noContent(setCookies: string[] = []): CloudFrontResultResponse {
  return { status: "204", statusDescription: "No Content", headers: baseHeaders(undefined, setCookies) };
}

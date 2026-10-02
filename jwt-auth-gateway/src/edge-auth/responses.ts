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

export function redirect(location: string, setCookies: string[] = []): CloudFrontResultResponse {
  const headers = baseHeaders(undefined, setCookies);
  headers.location = [{ key: "Location", value: location }];
  return { status: "302", statusDescription: "Found", headers };
}

export function textResponse(status: string, statusDescription: string, body: string, setCookies: string[] = []): CloudFrontResultResponse {
  return { status, statusDescription, headers: baseHeaders("text/plain; charset=utf-8", setCookies), body };
}

export function jsonResponse(status: string, statusDescription: string, body: object, setCookies: string[] = []): CloudFrontResultResponse {
  return { status, statusDescription, headers: baseHeaders("application/json; charset=utf-8", setCookies), body: JSON.stringify(body) };
}

export function noContent(setCookies: string[] = []): CloudFrontResultResponse {
  return { status: "204", statusDescription: "No Content", headers: baseHeaders(undefined, setCookies) };
}

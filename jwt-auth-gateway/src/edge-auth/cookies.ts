/**
 * Cookie parsing and `Set-Cookie` construction in CloudFront's header shape.
 */
import type { CloudFrontHeaders } from "aws-lambda";

export interface CookieOptions {
  /** Defaults to `/`. */
  path?: string;
  maxAgeSeconds?: number;
  /** Defaults to `Lax`: the cookie must survive the top-level redirect back from Cognito. */
  sameSite?: "Strict" | "Lax";
}

/**
 * Reads every `Cookie` header into a name → value map. CloudFront can present several `Cookie`
 * header entries, so all of them are read. A value that fails to URI-decode is skipped rather
 * than failing the whole request.
 */
export function parseCookies(headers: CloudFrontHeaders): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of headers.cookie ?? []) {
    for (const pair of header.value.split(";")) {
      const separator = pair.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const name = pair.slice(0, separator).trim();
      try {
        cookies[name] = decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        // Malformed encoding; ignore this cookie.
      }
    }
  }
  return cookies;
}

/**
 * Builds a `Set-Cookie` value. Every cookie this gateway sets is `Secure` and `HttpOnly`, so no
 * token is ever readable by JavaScript in any of the hosted apps. There is deliberately no
 * `Domain` attribute: cookies stay on the exact host that set them.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    "Secure",
    "HttpOnly",
    `SameSite=${options.sameSite ?? "Lax"}`,
  ];
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }
  return parts.join("; ");
}

/** Builds a `Set-Cookie` value that deletes the cookie. `path` must match the one it was set with. */
export function clearCookie(name: string, path = "/"): string {
  return serializeCookie(name, "", { path, maxAgeSeconds: 0 });
}

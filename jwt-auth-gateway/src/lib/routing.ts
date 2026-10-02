/**
 * Path rules: which requests are public, which go to the API, and how a deep link is mapped
 * to its app's `index.html`.
 *
 * Also runs in the CloudFront Functions runtime, so it sticks to the syntax that runtime
 * supports (see lib/session.ts).
 */

/** Paths every browser asks for unprompted; gating them only produces noise. */
const ALWAYS_PUBLIC = ["/favicon.ico", "/robots.txt"];

/**
 * Empty segments (`//`), dot segments (`/./`, `/../`), backslashes, and percent-encoded dots,
 * slashes and backslashes.
 */
const NON_NORMALISED = /\/\/|\/\.\.?(\/|$)|\\|%2e|%2f|%5c/i;

/**
 * True when the path is already in the form CloudFront uses to pick a cache behaviour.
 * CloudFront matches behaviours against the *normalised* path, but hands the *raw* path to edge
 * functions and origins. Deciding on a raw path that normalises to something else lets a
 * request be judged as one path and served as another, e.g. `//billing` looking public when
 * `/` is public. The gate refuses such paths outright instead of trying to normalise them.
 */
export function isNormalisedPath(uri: string): boolean {
  return uri.startsWith("/") && !NON_NORMALISED.test(uri);
}

/**
 * True when `path` equals `prefix` or sits beneath it, e.g. `/public/x` but not `/publications`.
 * A prefix of `/` means the site root only, never "everything".
 */
function isUnder(path: string, prefix: string): boolean {
  if (prefix === "/") {
    return path === "/";
  }
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** True for a request served without a login. */
export function isPublicPath(uri: string, publicPaths: string[]): boolean {
  return ALWAYS_PUBLIC.includes(uri) || publicPaths.some((prefix) => isUnder(uri, prefix));
}

/** True for a request that should be proxied to the API origin. Always false when `apiPrefix` is empty. */
export function isApiPath(uri: string, apiPrefix: string): boolean {
  return apiPrefix !== "" && isUnder(uri, apiPrefix);
}

/** Maps `/api/orders/5` to `/orders/5` so the path matches the API's own routes. */
export function stripApiPrefix(uri: string, apiPrefix: string): string {
  return uri.slice(apiPrefix.length) || "/";
}

/** True when the last path segment has a file extension, e.g. `app.js` or `index.html`. */
function hasExtension(uri: string): boolean {
  return uri.slice(uri.lastIndexOf("/") + 1).includes(".");
}

/**
 * True for a request a browser makes as a page navigation, which can follow a redirect to the
 * sign-in page. Anything else (a script, stylesheet or image) gets a plain 401 instead, because
 * a `<script>` tag can't do anything useful with a login page.
 */
export function isPageRequest(uri: string): boolean {
  return !hasExtension(uri) || uri.endsWith(".html");
}

/**
 * Maps an extensionless path to the `index.html` of the app that owns it, so client-side
 * routers get their deep links and S3 (which has no directory index behind Origin Access
 * Control) gets a real object key:
 *
 *   /                      → /index.html              (Trailhead shell at the root)
 *   /customers             → /customers/index.html
 *   /customers/42/orders   → /customers/index.html    (deep link, URL bar unchanged)
 *   /customers/app.js      → unchanged                (real asset)
 *
 * With an `appBasePath` of `/apps`, the same rules apply beneath `/apps`, and anything outside
 * it is left alone. Paths are decided by shape alone: at viewer-request there is no way to know
 * whether an object exists, and a missing asset should 404 rather than return HTML.
 */
export function resolveAppShell(uri: string, appBasePath: string): string {
  if (hasExtension(uri)) {
    return uri;
  }
  if (appBasePath !== "" && !isUnder(uri, appBasePath)) {
    return uri;
  }
  const app = uri.slice(appBasePath.length).split("/").find((segment) => segment !== "");
  return app ? `${appBasePath}/${app}/index.html` : `${appBasePath}/index.html`;
}

/**
 * Returns `candidate` if it is a same-site path, otherwise `/`. Guards every redirect that takes
 * its target from the request, so the sign-in flow can't be turned into an open redirect.
 * Rejects `//host` and `/\host` (browsers treat the backslash as a slash) as well as control
 * characters.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return "/";
  }
  return /[\u0000-\u001f\u007f]/.test(candidate) ? "/" : candidate;
}

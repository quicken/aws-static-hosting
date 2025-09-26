/**
 * Checks if the given pathname is an SPA route (no file extension)
 * @param pathname - The URL pathname to check
 * @returns True if pathname appears to be an SPA route
 */
export function isSpaRoute(pathname: string): boolean {
  return !pathname.match(/\.[a-zA-Z0-9]+$/);
}

/**
 * Checks if the given pathname is public (no authentication required)
 * @param pathname - The URL pathname to check
 * @returns True if pathname is public
 */
export function isPublicPath(pathname: string): boolean {
  return pathname === '/' || 
         pathname === '/index.html' || 
         pathname.startsWith('/public');
}

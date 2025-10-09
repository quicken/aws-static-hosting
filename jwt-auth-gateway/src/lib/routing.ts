/**
 * Rewrites incoming URLs to support single page react applications.
 * .
 * @param pathname The pathname to which rewrite rules are applied.
 * @returns
 */
export function rewrite(pathname: string): string {
  if (!isSpaRoute(pathname)) {
    return pathname;
  }

  /* Support a public facing home page. */
  if (pathname === "/") {
    return "/public/index.html";
  }

  /* Allow a generic login react application to be hosted within the auth folder. */
  if (pathname.startsWith("/auth")) {
    return "/auth/index.html";
  }

  /**
   * Support hosting multiple single page react applications inside the defined SPA base path folder.
   */
  const spaBasePath = process.env.SPA_BASE_PATH || "";
  if (spaBasePath && pathname.startsWith(`/${spaBasePath}`)) {
    const pathSegments = pathname.split("/").filter(Boolean);
    if (pathSegments.length > 1) {
      const appFolder = pathSegments[1];
      return `/${spaBasePath}/${appFolder}/index.html`;
    } else {
      return `/${spaBasePath}/index.html`;
    }
  }

  return pathname;
}

/**
 * Checks if the given pathname is an SPA route (no file extension)
 * @param pathname - The URL pathname to check
 * @returns True if pathname appears to be an SPA route
 */
function isSpaRoute(pathname: string): boolean {
  return !pathname.match(/\.[a-zA-Z0-9]+$/);
}

/**
 * Checks if the given pathname is considered to be "public" (no authentication required)
 * @param pathname - The URL pathname to check
 * @returns True if pathname is public
 */
export function isPublicPath(pathname: string): boolean {
  // Root, auth and public folders are always public
  if (pathname === "/" || pathname === "/index.html" || pathname.startsWith("/auth") || pathname.startsWith("/public")) {
    return true;
  }

  // Everything else is private.
  return false;
}

export function redirectResponse(target: string) {
  return {
    status: "302",
    statusDescription: "Found",
    headers: {
      location: [
        {
          key: "Location",
          value: target,
        },
      ],
    },
  };
}

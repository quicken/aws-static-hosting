import { CloudFrontRequestEvent, CloudFrontResponseEvent } from "aws-lambda";
import { isSpaRoute, isPublicPath } from "./lib/routing";
import { isAuthenticated } from "./lib/auth";

/**
 * Lambda@Edge authorization function for Cognito-protected React applications
 * @param event - CloudFront request event
 * @returns Authorization result - either continue to origin or redirect
 */
export const handler = async (event: CloudFrontRequestEvent | CloudFrontResponseEvent) => {
  try {
    if (event.Records[0].cf.config.eventType !== "viewer-request") {
      return event.Records[0].cf.request;
    }

    const request = event.Records[0].cf.request;
    const requestPath = request.uri;

    const isPublic = isPublicPath(requestPath);
    console.log("Route classification:", { uri: requestPath, isPublic, isSpa: isSpaRoute(requestPath) });

    // Handle SPA routes (check authorization and rewrite)
    if (isSpaRoute(requestPath)) {
      // Check authentication for protected routes
      if (!isPublic) {
        console.log("Checking authentication for protected route");
        const authenticated = await isAuthenticated(request);
        console.log("Authentication result:", authenticated);

        if (!authenticated) {
          console.log("Redirecting unauthenticated user to auth service with return URL");
          return {
            status: "302",
            statusDescription: "Found",
            headers: {
              location: [
                {
                  key: "Location",
                  value: `/auth/?return_url=${encodeURIComponent(request.uri)}`,
                },
              ],
            },
          };
        }
      }

      // Only rewrite URI for SPA routes (not direct file requests)
      if (requestPath !== "/index.html" && requestPath !== "/auth/index.html") {
        if (requestPath === '/') {
          // Root always goes to /index.html (public home page)
          request.uri = "/index.html";
        } else if (requestPath.startsWith('/auth')) {
          // Auth SPA routes
          request.uri = "/auth/index.html";
        } else {
          // Check if this is a protected SPA route
          const spaBasePath = process.env.SPA_BASE_PATH || '';
          
          if (spaBasePath && requestPath.startsWith(`/${spaBasePath}`)) {
            // Protected SPA routing: use base path + app folder
            const pathSegments = requestPath.split('/').filter(Boolean);
            if (pathSegments.length > 1) {
              const appFolder = pathSegments[1]; // Skip base path, get app name
              request.uri = `/${spaBasePath}/${appFolder}/index.html`;
            } else {
              // Just base path, go to main SPA
              request.uri = `/${spaBasePath}/index.html`;
            }
          } else {
            // Public routes - pass through (no rewrite needed for non-SPA)
            // This handles /public/*, /assets/*, etc.
          }
        }
        
        if (request.uri !== requestPath) {
          console.log("SPA route rewritten to:", request.uri);
        }
      } else {
        console.log("Direct file request, passing through:", requestPath);
      }

      return request;
    } else {
      // Handle asset requests - allow public assets, block others
      if (isPublic) {
        console.log("Public asset request, passing through:", requestPath);
        return request;
      }
      
      // Handle HTML files with authentication check
      if (requestPath.endsWith('.html')) {
        console.log("Checking authentication for protected HTML file");
        const authenticated = await isAuthenticated(request);
        console.log("Authentication result:", authenticated);

        if (!authenticated) {
          console.log("Redirecting unauthenticated user to auth service with return URL");
          return {
            status: "302",
            statusDescription: "Found",
            headers: {
              location: [
                {
                  key: "Location",
                  value: `/auth/?return_url=${encodeURIComponent(request.uri)}`,
                },
              ],
            },
          };
        }
        
        console.log("HTML file request, passing through:", requestPath);
        return request;
      }
      
      // Protected asset requests return 404
      console.log("Protected asset request, returning 404");
      return {
        status: "404",
        statusDescription: "Not Found",
        headers: {
          "content-type": [
            {
              key: "Content-Type",
              value: "text/plain",
            },
          ],
        },
        body: "Not Found",
      };
    }
  } catch (error) {
    console.error("Lambda@Edge Error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Event that caused error:", JSON.stringify(event, null, 2));

    // Return 500 error response
    return {
      status: "500",
      statusDescription: "Internal Server Error",
      headers: {
        "content-type": [
          {
            key: "Content-Type",
            value: "text/plain",
          },
        ],
      },
      bodyEncoding: "text",
      body: "Internal Server Error",
    };
  }
};

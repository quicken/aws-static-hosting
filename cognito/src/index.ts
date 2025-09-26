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
    //console.log("Lambda@Edge START:", JSON.stringify(event, null, 2));

    if (event.Records[0].cf.config.eventType !== "viewer-request") {
      event.Records[0].cf.request;
    }

    const request = event.Records[0].cf.request;
    const requestPath = request.uri;

    const isPublic = isPublicPath(requestPath);
    console.log("Route classification:", { uri: requestPath, isPublic, isSpa: isSpaRoute(requestPath) });

    // Handle SPA routes (check authorization)
    if (isSpaRoute(requestPath)) {
      // Check authentication for protected routes
      if (!isPublic) {
        console.log("Checking authentication for protected route");
        const authenticated = await isAuthenticated(request);
        console.log("Authentication result:", authenticated);

        if (!authenticated) {
          console.log("Redirecting unauthenticated user to login");
          return {
            status: "302",
            statusDescription: "Found",
            headers: {
              location: [
                {
                  key: "Location",
                  value: "/public/login",
                },
              ],
            },
          };
        }
      }

      // Authorized - let CloudFront continue to origin
      console.log("Request authorized, continuing to origin");
      return request;
    } else {
      // Asset requests return 404 - React apps should bundle assets or use CDN
      console.log("Asset request, returning 404");
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

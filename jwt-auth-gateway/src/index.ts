import { CloudFrontRequestEvent, CloudFrontResponseEvent } from "aws-lambda";
import { rewrite, isPublicPath, redirectResponse } from "./lib/routing";
import { isAuthenticated } from "./lib/auth";

/**
 * Lambda@Edge authorization function for Cognito JWT protected React applications.
 * @param event - CloudFront request event
 * @returns CloudFrontResponse- either continue to origin, or redirect.
 */
export const handler = async (event: CloudFrontRequestEvent | CloudFrontResponseEvent) => {
  try {
    if (event.Records[0].cf.config.eventType !== "viewer-request") {
      return event.Records[0].cf.request;
    }

    const request = event.Records[0].cf.request;
    const originalPath = request.uri;

    request.uri = rewrite(request.uri);

    if (!isPublicPath(request.uri)) {
      const authenticated = await isAuthenticated(request);
      if (!authenticated) {
        if (request.uri.endsWith(".html")) {
          return redirectResponse(`/auth/?return_url=${encodeURIComponent(originalPath)}`);
        } else {
          return FILE_NOT_FOUND;
        }
      }
    }
    return request;
  } catch (error) {
    console.error("Lambda@Edge Error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Event that caused error:", JSON.stringify(event, null, 2));

    return INTERNAL_SERVER_ERROR;
  }
};

const FILE_NOT_FOUND = {
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

const INTERNAL_SERVER_ERROR = {
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
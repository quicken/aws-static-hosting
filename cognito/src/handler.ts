import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { isSpaRoute, isPublicPath } from "./lib/routing";
import { isAuthenticated } from "./lib/auth";

/**
 * Lambda@Edge authorization function for Cognito-protected React applications
 * @param event - API Gateway proxy event
 * @returns Authorization result - either continue to origin or redirect
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestPath = event.path;
  const isPublic = isPublicPath(requestPath);

  // Handle SPA routes (check authorization)
  if (isSpaRoute(requestPath)) {
    // Check authentication for protected routes
    if (!isPublic && !(await isAuthenticated(event))) {
      return {
        statusCode: 302,
        headers: { Location: "/public/login" },
        body: "",
      };
    }

    // Authorized - let CloudFront serve the content
    return {
      statusCode: 200,
      body: "",
    };
  } else {
    // Asset requests return 404 - React apps should bundle assets or use CDN
    return {
      statusCode: 404,
      headers: {
        "Content-Type": "text/plain",
      },
      body: "Not Found",
    };
  }
};

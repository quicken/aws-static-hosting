import {
	CloudFrontRequestHandler,
	CloudFrontRequestEvent,
	CloudFrontResponseEvent,
	CloudFrontRequestResult,
	CloudFrontResultResponse
} from "aws-lambda";

/**
 * Set to true to enable basic authentication for your site.
 *
 *  Lambda Edge functions currently do not support environment variables. For the purpose
 * of securing a demo site.
 *
 * To protect anything that needs to be properly secure you will need a better approach than this code!
 */
const REQUIRE_AUTHENTICATION = false;

/**
 * An array of username / password pairs that can authenticate.
 */
const AUTH_CREDENTIALS = ["user1:secret_1", "user2:secret_2"];

export const handler: CloudFrontRequestHandler = async (event: CloudFrontRequestEvent | CloudFrontResponseEvent) => {
	try {
		let response: CloudFrontRequestResult;

		switch (event.Records[0].cf.config.eventType) {
			case "viewer-request": {
				if (REQUIRE_AUTHENTICATION && !isAuthenticated(event, AUTH_CREDENTIALS)) {
					response = requestPasswordResponse;
				} else {
					response = alwayIncludeFilename(event);
				}
				break;
			}

			case "origin-request": {
				response = (event as CloudFrontRequestEvent).Records[0].cf.request;
				break;
			}

			/* do nothing */
			case "viewer-response":
			case "origin-response": {
				response = (event as CloudFrontResponseEvent).Records[0].cf.request;
				break;
			}
		}
		return response;
	} catch (err: any) {
		console.log(err);

		const response: CloudFrontResultResponse = {
			status: "500",
			statusDescription: "lambda error processing request. (image uri rewriting.)",
			body: ""
		};

		return response;
	}
};

/* Checks the basic authentication header. */
const isAuthenticated = (event: CloudFrontRequestEvent, authCredentials: string[]) => {
	const authStrings: string[] = [];
	let i = 0;

	// construct a basic auth strings
	authCredentials.forEach((element) => {
		authStrings[i] = "Basic " + Buffer.from(element).toString("base64");
		i++;
	});

	const request = event.Records[0].cf.request;
	const headers = request.headers;

	return typeof headers.authorization != "undefined" && authStrings.includes(headers.authorization[0].value);
};

const requestPasswordResponse: CloudFrontRequestResult = {
	status: "401",
	statusDescription: "Unauthorized",
	body: "Unauthorized",
	headers: {
		"www-authenticate": [{ key: "WWW-Authenticate", value: 'Basic realm="Authentication"' }]
	}
};

/**
 * For any request for folder or a request without a filename rewrite the
 * request to be to an index.html file within the requested folder.
 *
 * Note: This code currently does not work where file the name itself contains a dot.
 * @param event
 * @returns
 */
const alwayIncludeFilename = (event: CloudFrontRequestEvent) => {
	const request = event.Records[0].cf.request;
	const uri = request.uri;
	if (uri.endsWith("/")) {
		request.uri += "index.html";
	}
	// Check whether the URI is missing a file extension.
	else if (!uri.includes(".")) {
		request.uri += "/index.html";
	}

	return request;
};

# AWS-static-hosting

This project contains code that can be useful when hosting a static JS Application that uses client-side routing behind an AWS Cloudfront distribution.

The sample lambda demonstrated protecting a JS App hosted with CloudFront and S3 using basic authentication. As well as demonstrating re-writing URLs in cases where the Client-Side routing hides files behind directory names.

The code has been used with DocuSaurus, Next.js as well as React Applications and is likely to work with any application that works similarly.

## Hosting your JS App in AWS

Watch this tutorial for a full guide on hosting your JS App in AWS including deployment of this function code.
[How to Host your JS App on AWS like a BOSS](https://youtu.be/Pb23xfcLMJc)

## Building

If you do not wish to or can't build the project you can grab a compiled copy of the javascript code from the release section on git hub.

[View Releases](https://github.com/quicken/aws-static-hosting/releases)

1. Clone this repository
2. ```bash
   nvm use
   yarn install
   yarn build
   ```
    The build outputs javascript files into the "dist" folder. These files contain the JavaScript code that needs to be uploaded to AWS.

## Deployment

A full walkthrough of setting up hosting of static JS site including deployment of this code can be found on youtube.

Open the lambda edge function.
Copy and Paste the generated javascript from the lambd_edge_static_site.js directly into the index.js file inside of the lambda web console.

See the build section for more information.

1. Deploy the Lambda. (NOTE: This is different to deploy to lambda edge. If this step is skipped the old code will be deployed to lambda edge.)
2. Deploy the Lamba to Cloudfrount: Action -> Deploy To Lambda Edge.
3. Selected the event: viewer request
4. If you have enabled basic authentication you must also check the option: "body".
5. Deploy the Lamda.

## Enabling Basic Authentication

Within the javascript change the property **"REQUIRE_AUTHENTICATION"** from false to true. Then be sure to set the set of username/passwords that are allowed to authenticate in the array **"AUTH_CREDENTIALS"**.

Be aware that using Basic Authentication requires checking the "body" option when deploying the "viewer_request" event to lambda edge.

## Known Issue:

If a folder contains a period index.html is not automatically appended causing a 403 or 404 error instead of serving up the page.

This can be mitigated by additionally rewriting all 403 errors with the /index.html page using the CloudFront error re-write functionality.

Using this "hack" any 403 error returned by CloudFront is re-written to status code 200 and the /index.html page is served up. In combination with the basic auth implemented by this lambda is not an issue.

### Generating TypeDocs.

```bash
yarn docs
```

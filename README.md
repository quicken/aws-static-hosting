# AWS Static Hosting

Code for hosting static JavaScript apps that use client-side routing (React, Vue, Docusaurus, a [Trailhead](https://github.com/quicken/trailhead) shell and its apps) on S3 behind CloudFront. It's one of the cheapest and most scalable ways to host a single page app on AWS.

## Projects

| Folder | What it is |
| --- | --- |
| [`jwt-auth-gateway/`](jwt-auth-gateway/README.md) | Cognito login at the edge (PKCE, HttpOnly cookies, silent refresh), per-app deep-link routing, an optional same-origin API proxy, and CloudFormation for the lot. Built to host Trailhead. |
| [`basic-auth/`](basic-auth/README.md) | The Lambda@Edge function from the YouTube tutorial: SPA routing with optional basic authentication. Fine for a demo or staging site. |
| [`example-site/`](example-site/README.md) | A dependency-free static site for testing the hosting approaches — a public landing page, public assets, a login-gated app, and an SPA with deep links. Upload it with the included `deploy-site.sh` to verify a deployment. |

## Hosting your JS app on AWS

The YouTube tutorial walks through the whole setup by hand, using the `basic-auth` function:

**[How to Host your JS App on AWS like a BOSS](https://youtu.be/Pb23xfcLMJc)**

`jwt-auth-gateway` is the grown-up version of the same idea: a real login instead of a shared password, several apps under one distribution, and infrastructure as code.

## Licence

[MIT](LICENSE)

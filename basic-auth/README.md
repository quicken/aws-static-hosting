# AWS Static Hosting — Basic Authentication

This subproject demonstrates a simple and **cost-effective approach** for hosting static JavaScript applications that use client-side routing (e.g. React, Next.js, or Docusaurus) behind an **AWS CloudFront distribution**.

It provides a **Lambda@Edge function** that supports **Basic Authentication** for protecting private content such as internal applications or staging sites.
This setup is ideal for lightweight use cases where **enterprise authentication** (such as Cognito or OAuth2) would be overkill.

---

## Overview

This example showcases one of the **most scalable and affordable** ways to host a **Single Page Application (SPA)** in AWS.
The Lambda function included handles routing, authentication, and fallback logic for serving your app correctly from CloudFront and S3.

Key features include:

-   Support for **client-side routing**
-   **Basic Authentication** for private or internal sites
-   Optional protection of source code or static assets
-   Compatibility with **React**, **Next.js**, and **Docusaurus** builds

---

## Watch the Tutorial

**[How to Host Your JS App on AWS like a BOSS](https://youtu.be/Pb23xfcLMJc)**
This YouTube guide walks you through hosting your JavaScript app on AWS, including the deployment of this Lambda@Edge function.

---

## Building the Project

If you prefer not to build the project yourself, you can download a precompiled version of the JavaScript files from the **GitHub Releases** section:

👉 [View Releases](https://github.com/quicken/aws-static-hosting/releases)

To build locally:

```bash
nvm use
yarn install
yarn build
```

This will output the compiled JavaScript files into the `dist` folder.
These files contain the code that you’ll deploy to your AWS Lambda function.

---

## Enabling Basic Authentication

To enable Basic Authentication:

1. In the JavaScript source, set:

    ```js
    const REQUIRE_AUTHENTICATION = true;
    ```

2. Define your credentials in:

    ```js
    const AUTH_CREDENTIALS = [{ username: "user", password: "pass" }];
    ```

> **Note:** Basic Authentication requires selecting the **Include Body** option when deploying to the **viewer_request** event in Lambda@Edge.

---

## Known Issue

If a folder path contains a period (`.`), CloudFront may fail to append `index.html`, resulting in a **403 or 404 error**.
This can be resolved by configuring **CloudFront error page rewrites**:

-   Rewrite **403 errors** to `/index.html`
-   Return **HTTP status 200**

This effectively ensures your SPA loads correctly, even for nested routes, without breaking authentication.

---

## Generating TypeDocs

To generate documentation for the codebase:

```bash
yarn docs
```

---

**In short:**
This project is a lightweight, low-cost, and highly practical solution for hosting protected JavaScript SPAs on AWS — perfect for prototypes, internal tools, or private app demos.

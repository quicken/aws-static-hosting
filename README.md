# AWS Static Hosting

This project provides practical examples and code for hosting static JavaScript applications that use client-side routing (such as React, Next.js, or Docusaurus) behind an **AWS CloudFront distribution**.

It demonstrates one of the **most cost-effective and scalable** ways to host a **Single Page Application (SPA)** in AWS. The included Lambda@Edge functions handle routing and security, enabling you to protect private content — including source code — using either **Basic Authentication** or a more advanced **JWT-based validation** approach.

The project also includes a sample **React UI** that implements OAuth2 with PKCE, showing how to build a **complete hosting solution** for private or membership-based content using **AWS Cognito** as the identity provider.

---

## Repository Update

**New:** For teams or environments that require more enterprise-grade security, this repository now includes an example of a **JWT-based authentication gateway** as an alternative to the Basic Authentication method shown in the YouTube tutorial.
The overall hosting principle remains the same.

---

## Project Structure

- **`basic-auth/`** — Basic Authentication (code featured in the YouTube tutorial)
- **`jwt-auth-gateway/`** — Enterprise-ready JWT validation with AWS Cognito
- **`auth-ui/`** — React application implementing OAuth2 Authorisation Code with PKCE

---

## Enterprise Authentication Solution

The **`jwt-auth-gateway`** and **`auth-ui`** projects together form a complete, production-ready authentication solution for hosting secure SPAs on AWS CloudFront, offering:

- Seamless **AWS Cognito integration**
- **JWT token validation** for protected routes
- Full **OAuth2 Authorisation Code with PKCE** flow
- Support for **multiple applications** under a single CloudFront distribution

For setup and usage details, see the individual project READMEs.

---

## Hosting Your JS App in AWS

Watch the accompanying **YouTube tutorial** for a complete walkthrough on deploying your JavaScript app to AWS — including how to configure and deploy the Lambda@Edge functions provided in this repository.

**How to Host Your JS App on AWS Like a BOSS**

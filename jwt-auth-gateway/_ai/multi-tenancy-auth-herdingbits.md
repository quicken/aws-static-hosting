# Multi-Tenancy Auth Design — HerdingBits SaaS

> **Status:** Decided (design only — nothing built yet)
> **Date:** 2026-10-03
> **Scope:** Extends the `jwt-auth-gateway` architecture. No code changes required by this
> decision today; this is the plan for when tenancy is actually implemented.
> **Relates to:** `jwt-auth-gateway/cloudformation/cognito.yaml`, `jwt-auth-gateway/src/edge-auth/`

## Context

This builds on the architecture already in `jwt-auth-gateway`: a CloudFront Function gate that does
authentication only, forwards the Cognito **id-token** as the `Authorization: Bearer`, and leaves
authorisation to an API Gateway JWT authorizer. One shared Cognito user pool, a public PKCE client,
Managed Login, id/access tokens at 5 minutes, refresh at 30 days.

The question this design answers: how do you add multi-tenancy to that stack **without changing the
gate's role**? The gate must stay dumb — it should never learn what a tenant is.

## Core decision

**Single-host-with-switcher is the source of truth for tenancy; vanity subdomains are advisory
hints that pre-select the active tenant and are always re-verified at token-mint.** A subdomain
never grants access — it only proposes a default. The trust decision happens server-side, on a
signed claim, every time a token is minted.

## Identity model

- **One shared user pool.** One human is one identity (`sub`) across every tenant. No
  pool-per-tenant: a user can't exist in two pools, and that model collapses the moment someone
  belongs to more than one organisation.
- **Membership is data you own, not a Cognito structure.** A
  `user (sub) ──< membership (role) >── tenant` relationship in your own store (DynamoDB or RDS).
  This is what handles one-user-to-many-tenants — a single `custom:tenant_id` attribute on the
  Cognito user cannot.
- **Two orthogonal axes:**
  - `cognito:groups` = the user's **role within a tenant** (admin / member / viewer).
  - A separate claim = the **active tenant** the current token is scoped to.

## Active-tenant mechanism

- The token carries the **active** tenant, not a fixed one. Switching tenant means minting a new
  token — cheap, given the 5-minute lifetime.
- A **pre-token-generation Lambda** is the integrity boundary. It reads the requested active-tenant
  (from the subdomain hint or the in-app switcher), **verifies the user is genuinely a member
  against the membership table**, and only then stamps `custom:active_tenant` plus the role for that
  tenant. It never trusts the browser-supplied value.
- The **API Gateway authorizer** enforces `active_tenant` match + group role, on a signed claim it
  can trust.

## Sign-in flows

**Primary host (`app.mysaas.com`) — the picker path**

1. Authenticate.
2. Read membership.
3. Zero tenants → onboarding; one → auto-activate; more than one → show a tenant chooser.
4. Mint the token with the verified `active_tenant`.

**Vanity host (`mycompany.app.mysaas.com`) — the smooth path**

1. The host carries the tenant hint.
2. Authenticate.
3. The pre-token Lambda checks membership.
4. Member → auto-activate `mycompany` straight into the workspace. Non-member → fall back to the
   primary-host picker / request-access screen. **Do not leak whether the tenant exists.**

## The sharp edges

1. **Always authenticate on the primary host.** Register exactly **one** Cognito callback
   (`app.mysaas.com/_auth/callback`) — Cognito has no wildcard callback support. Carry the tenant
   hint through the OAuth `state` parameter, then redirect to the vanity host *after* login. This is
   what keeps `cognito.yaml` static: no per-tenant callback registration, ever.
2. **Cookie scope — the one change that touches `edge-auth`.** Use **domain-scoped** session cookies
   (`.app.mysaas.com`) so SSO is smooth across hosts. This is safe *only because* authorisation keys
   on the verified `active_tenant` claim, not on the host. The gate reads the cookie (who you are);
   the claim decides the tenant (what you can do). This is set in `edge-auth`'s cookie-writing path.
   > Note: domain-scoped cookies are `__Secure-`, not `__Host-` — the `__Host-` prefix forbids a
   > `Domain` attribute. That's a real change to the current cookie model, which uses `__Host-` for
   > the id-token. Weigh it when implementing.
   >
   > **Seam already cut (2026-10-03):** `serializeCookie` in `src/edge-auth/cookies.ts` now takes an
   > optional `domain` and emits `Domain=` only when set. Today every call site passes nothing, so
   > output is byte-identical and host-pinning is unchanged. The deferred work is therefore just: (a)
   > pass `domain` at the call site, and (b) rename the id/signature cookies from `__Host-` to
   > `__Secure-` in `src/lib/constants.ts` — the single remaining security tradeoff, not a mechanical
   > edit.
3. **The gate stays dumb.** The CloudFront Function gate remains authentication-only through all of
   this. It never learns about tenants. This invariant is the whole point — preserve it.
4. **Infra prerequisite: wildcard TLS.** Per-tenant vanity hosts need `*.app.mysaas.com` on
   CloudFront and a wildcard-capable ACM certificate. That's a cert/distribution concern, not an
   identity one — but price it in before committing to subdomains.

## Now vs later

**Now (this login stack):** nothing is forced. `cognito.yaml` needs no change today to keep this
path open.

**Later, when tenancy is implemented:**

- [ ] Membership table (`user × tenant × role`)
- [ ] Pre-token-generation Lambda (the integrity boundary)
- [ ] Authorizer logic: enforce `active_tenant` + group role
- [x] ~~Domain-capable `serializeCookie`~~ — seam cut 2026-10-03 (optional `domain`, no behaviour change)
- [ ] Pass `domain` at the cookie call site + rename `__Host-` → `__Secure-` in `constants.ts` (the real tradeoff)
- [ ] Wildcard ACM cert + CloudFront distribution for vanity hosts

## Guiding principle

The subdomain is a convenience that sets a default; **defaults are always re-validated at
token-mint.** It's the same mental model that keeps the gate authentication-only: hints are cheap,
trust decisions are signed and server-side.

# Demo Cognito user pool for the jwt-auth-gateway: a pool, a hosted UI domain and a public
# (PKCE, no secret) app client. Mirrors ../cloudformation/cognito.yaml, which stays the reference.
# Unlike that template, nothing here is retained: this is a rig to spin up and tear down.

terraform {
  required_version = ">= 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.region

  # Organising tags applied to every taggable resource; keys and values lowercase. Idiomatic
  # provider-wide default rather than hand-tagging each resource.
  default_tags {
    tags = {
      project    = "aws-static-hosting"
      deployment = var.name
    }
  }
}

locals {
  # Until the hosting side exists there is no site host to call back to. localhost is the one
  # plain-http callback Cognito accepts, and nothing will ever sign in through it.
  site_origin = var.site_host == "" ? "http://localhost" : "https://${var.site_host}"
}

# Hosted UI prefixes are globally unique across all AWS accounts.
resource "random_string" "domain_suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "aws_cognito_user_pool" "this" {
  name                     = "${var.name}-aws-static-hosting-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  deletion_protection      = "INACTIVE"

  admin_create_user_config {
    allow_admin_create_user_only = var.admin_create_user_only
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  user_pool_id = aws_cognito_user_pool.this.id
  # EXEMPT from the -aws-static-hosting- literal: this is a globally-unique hosted-UI hostname
  # capped at 63 chars, so it keeps its bare prefix + random suffix rather than the convention.
  domain = "${var.name}-${random_string.domain_suffix.result}"
  # Version 2 is the newer Managed Login (branding designer); the branding resource below supplies
  # the style it renders. Version 1 is the classic hosted UI.
  managed_login_version = 2
}

# Public client: no secret, authorisation code grant only. The gateway always sends a PKCE
# code_challenge, so Cognito insists on the matching verifier when the code is redeemed.
resource "aws_cognito_user_pool_client" "this" {
  user_pool_id                         = aws_cognito_user_pool.this.id
  name                                 = "${var.name}-aws-static-hosting-edge-gateway"
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["${local.site_origin}/_auth/callback"]
  logout_urls                          = ["${local.site_origin}/"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  enable_token_revocation              = true
  prevent_user_existence_errors        = "ENABLED"

  # id/access deliberately short (5 min, Cognito's floor): the gate forwards the id-token as the
  # API Bearer and its refresh flow silently mints a new one, so a short token caps the blast
  # radius of a leak with no visible churn. Refresh is the real session length — keep
  # refresh_token_validity in step with REFRESH_TOKEN_MAX_AGE_SECONDS in src/lib/constants.ts.
  id_token_validity      = 5
  access_token_validity  = 5
  refresh_token_validity = 30

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }
}

# Applies Cognito's default polished Managed Login theme without designing anything; edit later in
# the branding editor. With use_cognito_provided_values the settings/assets must be omitted.
resource "aws_cognito_managed_login_branding" "this" {
  user_pool_id                = aws_cognito_user_pool.this.id
  client_id                   = aws_cognito_user_pool_client.this.id
  use_cognito_provided_values = true
}

# Demo Cognito user pool for the jwt-auth-gateway: a pool, a hosted UI domain and a public
# (PKCE, no secret) app client. Mirrors cloudformation/cognito.yaml, which stays the reference.
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
  name                     = "${var.name}-users"
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
  domain       = "${var.name}-${random_string.domain_suffix.result}"
}

# Public client: no secret, authorisation code grant only. The gateway always sends a PKCE
# code_challenge, so Cognito insists on the matching verifier when the code is redeemed.
resource "aws_cognito_user_pool_client" "this" {
  user_pool_id                         = aws_cognito_user_pool.this.id
  name                                 = "${var.name}-edge-gateway"
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

  # Keep refresh_token_validity in step with REFRESH_TOKEN_MAX_AGE_SECONDS in src/lib/config.ts.
  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }
}

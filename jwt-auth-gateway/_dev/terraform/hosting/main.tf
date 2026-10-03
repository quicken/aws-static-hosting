# Demo hosting for the jwt-auth-gateway: a private S3 bucket behind CloudFront, gated by the
# CloudFront Function, with Lambda@Edge serving /_auth/*. Mirrors ../cloudformation/hosting.yaml,
# which stays the reference; see its header for the reasoning behind the behaviours.
#
# The functions are built by build.mjs before this runs, and read from dist/. The gate's code
# carries the session key, so it is marked sensitive to keep it out of plan output. It still
# lands in state: run this through up.sh, which encrypts the state.

terraform {
  required_version = ">= 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

# Lambda@Edge functions must live in us-east-1, and so must a CloudFront certificate.
provider "aws" {
  region = "us-east-1"
}

locals {
  custom_domain = var.domain_name != ""
  has_api       = var.api_origin_domain != ""
  site_host     = local.custom_domain ? var.domain_name : aws_cloudfront_distribution.this.domain_name
  # Static behaviours (default + /public/*) cache hard when caching is on, and bypass the cache for
  # development when it is off. /_auth/* and the API are never cached regardless.
  static_cache_policy_id = var.cache_enabled ? data.aws_cloudfront_cache_policy.caching_optimized.id : data.aws_cloudfront_cache_policy.caching_disabled.id
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# API Gateway rejects a forwarded viewer Host header; this forwards everything else.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# ---------------------------------------------------------------------------
# Origin: private bucket, readable only by this distribution. S3 encrypts new objects with
# SSE-S3 by default. force_destroy lets down.sh remove it with the apps still in it.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "origin" {
  bucket_prefix = "${var.name}-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "origin" {
  bucket                  = aws_s3_bucket.origin.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "origin" {
  bucket = aws_s3_bucket.origin.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Deliberately no s3:ListBucket. A missing object is a 403 rather than a 404, but a request for
# the bucket root can never return a listing of every key.
resource "aws_s3_bucket_policy" "origin" {
  bucket = aws_s3_bucket.origin.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.origin.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.origin]
}

# ---------------------------------------------------------------------------
# Edge functions
# ---------------------------------------------------------------------------
resource "aws_iam_role" "edge" {
  name_prefix = "${var.name}-edge-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"] }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "edge_logs" {
  role       = aws_iam_role.edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "archive_file" "auth_routes" {
  type        = "zip"
  source_file = "${var.dist_dir}/auth-routes.mjs"
  output_path = "${var.dist_dir}/auth-routes.zip"
}

# publish gives CloudFront the numbered version it needs. Every build changes the code (it mints
# a fresh sign-in state key), so every apply publishes a new version and repoints the
# distribution. Old versions are left behind, as they are with CloudFormation.
#
# skip_destroy: Lambda refuses to delete a function while CloudFront still has replicas of it,
# and replicas take hours to clear after the distribution goes. Destroy forgets the function
# instead; down.sh prints the command to delete it later.
resource "aws_lambda_function" "auth_routes" {
  function_name    = "${var.name}-auth-routes"
  description      = "Viewer-request /_auth/* endpoints (sign-in, callback, refresh, sign-out)."
  runtime          = "nodejs24.x"
  handler          = "auth-routes.handler"
  filename         = data.archive_file.auth_routes.output_path
  source_code_hash = data.archive_file.auth_routes.output_base64sha256
  role             = aws_iam_role.edge.arn
  memory_size      = 128
  timeout          = 5
  publish          = true
  skip_destroy     = true
}

# The per-request gate.
resource "aws_cloudfront_function" "check_auth" {
  name    = "${var.name}-check-auth"
  comment = "Viewer-request login gate and deep-link rewrite."
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = sensitive(file("${var.dist_dir}/check-auth.cf.js"))
}

# ---------------------------------------------------------------------------
# Distribution
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = "${var.name} - static apps behind a Cognito login at the edge"
  http_version    = "http2and3"
  is_ipv6_enabled = true
  price_class     = var.price_class
  aliases         = local.custom_domain ? [var.domain_name] : []

  # Maps "/" to "/index.html" at the CloudFront level (S3 behind OAC has no directory index of its
  # own). Only the distribution root — subfolder indexes under /app are resolved by the gate's
  # deep-link rewrite instead.
  default_root_object = "index.html"

  origin {
    origin_id                = "s3"
    domain_name              = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  dynamic "origin" {
    for_each = local.has_api ? [var.api_origin_domain] : []
    content {
      origin_id   = "api"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Static app content. Cached (CachingOptimized) by default, because the gate runs at
  # viewer-request on every request, cache hits included. Everything served here must be identical
  # for every signed-in user. var.cache_enabled flips this to CachingDisabled for development.
  default_cache_behavior {
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.static_cache_policy_id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.check_auth.arn
    }
  }

  # Truly-public static assets (CSS, images, JS). NO function association at all: the gate never
  # runs here, so these are served to anyone at zero per-request cost — the same "no function on
  # this path" idea as the API behaviour, but for public files. Cached hard when caching is on;
  # var.cache_enabled flips it to CachingDisabled for development. Only HTML PAGES need the gate
  # (auth + deep-link rewrite); assets never do, so they live here and pages live under the
  # default/app behaviour. Put nothing private under /public/*.
  ordered_cache_behavior {
    path_pattern           = "/public/*"
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.static_cache_policy_id
  }

  # Auth endpoints answer from the edge and never reach S3. Never cached: every response sets or
  # clears cookies. POST is allowed for /_auth/refresh.
  ordered_cache_behavior {
    path_pattern           = "/_auth/*"
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_disabled.id

    lambda_function_association {
      event_type = "viewer-request"
      lambda_arn = aws_lambda_function.auth_routes.qualified_arn
    }
  }

  # Same-origin API: no CORS. Never cached, because responses are per-user.
  dynamic "ordered_cache_behavior" {
    for_each = local.has_api ? [var.api_prefix] : []
    content {
      path_pattern             = "${ordered_cache_behavior.value}/*"
      target_origin_id         = "api"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.check_auth.arn
      }
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.custom_domain
    acm_certificate_arn            = local.custom_domain ? var.certificate_arn : null
    ssl_support_method             = local.custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.custom_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

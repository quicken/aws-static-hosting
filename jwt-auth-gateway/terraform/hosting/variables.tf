variable "name" {
  type        = string
  description = "Prefix for every resource name."
  default     = "trailhead-demo"
}

variable "dist_dir" {
  type        = string
  description = "Where build.mjs wrote the functions."
  default     = "../../dist"
}

variable "domain_name" {
  type        = string
  description = "Optional custom domain, e.g. apps.example.com. Leave empty to use the CloudFront domain."
  default     = ""
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate in us-east-1 covering domain_name. Required when domain_name is set."
  default     = ""

  validation {
    condition     = var.domain_name == "" || var.certificate_arn != ""
    error_message = "certificate_arn (an ACM certificate in us-east-1) is required when domain_name is set."
  }
}

variable "api_origin_domain" {
  type        = string
  description = "Optional API origin host (e.g. abc123.execute-api.ap-southeast-2.amazonaws.com) served under api_prefix."
  default     = ""
}

variable "api_prefix" {
  type        = string
  description = "Same-origin API prefix. Must match API_PREFIX used when building the functions."
  default     = "/api"

  validation {
    condition     = can(regex("^/[A-Za-z0-9_-]+$", var.api_prefix))
    error_message = "One path segment with a leading slash, e.g. /api."
  }
}

variable "price_class" {
  type    = string
  default = "PriceClass_All"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "PriceClass_100, PriceClass_200 or PriceClass_All."
  }
}

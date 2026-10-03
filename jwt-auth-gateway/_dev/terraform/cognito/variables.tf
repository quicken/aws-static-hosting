variable "name" {
  type        = string
  description = "Prefix for every resource name. Also starts the hosted UI domain prefix."
  default     = "trailhead-demo"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,40}$", var.name))
    error_message = "Use lowercase letters, digits and hyphens, at most 41 characters."
  }
}

variable "region" {
  type        = string
  description = "Region for the user pool. It doesn't have to be us-east-1."
  default     = "ap-southeast-2"
}

variable "site_host" {
  type        = string
  description = "Host the apps are served from, e.g. apps.example.com or d111111abcdef8.cloudfront.net. Empty until the hosting side exists."
  default     = ""
}

variable "admin_create_user_only" {
  type        = bool
  description = "Leave true for internal apps, so only administrators can create users."
  default     = true
}

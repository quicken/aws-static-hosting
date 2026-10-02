output "bucket" {
  description = "Upload your built apps here."
  value       = aws_s3_bucket.origin.id
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "site_host" {
  description = "Pass this to the cognito module as site_host."
  value       = local.site_host
}

output "site_url" {
  value = "https://${local.site_host}/"
}

output "auth_routes_function" {
  description = "down.sh prints a delete command for this, since destroy leaves it behind."
  value       = aws_lambda_function.auth_routes.function_name
}

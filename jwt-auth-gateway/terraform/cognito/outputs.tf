# up.sh passes these to build.mjs as COGNITO_*.

output "region" {
  value = var.region
}

output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.this.id
}

output "domain" {
  value = "${aws_cognito_user_pool_domain.this.domain}.auth.${var.region}.amazoncognito.com"
}

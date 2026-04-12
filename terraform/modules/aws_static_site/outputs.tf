output "s3_bucket_id" {
  description = "S3 bucket name (sync `dist/` here after build)."
  value       = aws_s3_bucket.site.id
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.site.arn
}

output "cloudfront_distribution_id" {
  description = "Invalidate cache after deploy: `aws cloudfront create-invalidation ...`"
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront hostname (*.cloudfront.net or custom alias)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_url" {
  description = "HTTPS URL to open the SPA."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_arn" {
  value = aws_cloudfront_distribution.site.arn
}

output "waf_web_acl_arn" {
  description = "Present when enable_waf is true."
  value       = try(aws_wafv2_web_acl.cloudfront[0].arn, null)
}

output "cloudfront_response_headers_policy_id" {
  description = "Response headers policy attached to the default cache behavior (security headers + HSTS)."
  value       = aws_cloudfront_response_headers_policy.spa.id
}

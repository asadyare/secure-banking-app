output "s3_bucket_id" {
  description = "Bucket for `npm run build` output (sync with AWS CLI or CI)."
  value       = module.static_site.s3_bucket_id
}

output "cloudfront_domain_name" {
  description = "CloudFront hostname (or custom domain if configured)."
  value       = module.static_site.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "Use for cache invalidation after deploy."
  value       = module.static_site.cloudfront_distribution_id
}

output "cloudfront_url" {
  description = "HTTPS URL to the app."
  value       = module.static_site.cloudfront_url
}

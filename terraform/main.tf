module "static_site" {
  source = "./modules/aws_static_site"

  project_name = var.project_name
  environment  = var.environment
  bucket_name  = var.bucket_name

  domain_name         = var.domain_name
  hosted_zone_id      = var.hosted_zone_id
  acm_certificate_arn = var.acm_certificate_arn

  enable_waf = var.enable_waf

  hsts_max_age_sec        = var.hsts_max_age_sec
  hsts_include_subdomains = var.hsts_include_subdomains
  hsts_preload            = var.hsts_preload

  tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

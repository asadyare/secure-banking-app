variable "aws_region" {
  type        = string
  description = "Primary AWS region for S3 and regional resources (e.g. us-east-1)."
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Short name prefix for resources and tags (e.g. baawisan-bank)."
}

variable "environment" {
  type        = string
  description = "Environment label (e.g. staging, prod)."
}

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for static assets. If empty, a random suffix is appended to project-environment."
  default     = null
}

variable "domain_name" {
  type        = string
  description = "Optional custom domain for CloudFront (e.g. app.example.com). Requires ACM cert and Route53 zone."
  default     = null
}

variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for domain_name (optional)."
  default     = null
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN in us-east-1 for custom domain (CloudFront requirement). Leave null to use default CloudFront domain only."
  default     = null
}

variable "enable_waf" {
  type        = bool
  description = "Attach AWS WAF (managed rules) to CloudFront in us-east-1."
  default     = false
}

variable "hsts_max_age_sec" {
  type        = number
  description = "CloudFront response header Strict-Transport-Security max-age in seconds."
  default     = 31536000
}

variable "hsts_include_subdomains" {
  type        = bool
  description = "HSTS includeSubDomains. Use true when using a custom domain and all subdomains are HTTPS."
  default     = false
}

variable "hsts_preload" {
  type        = bool
  description = "HSTS preload (optional; coordinate with hstspreload.org)."
  default     = false
}

variable "tags" {
  type        = map(string)
  description = "Extra tags applied to supported resources."
  default     = {}
}

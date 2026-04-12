variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "bucket_name" {
  type    = string
  default = null
}

variable "domain_name" {
  type    = string
  default = null
}

variable "hosted_zone_id" {
  type    = string
  default = null
}

variable "acm_certificate_arn" {
  type    = string
  default = null
}

variable "enable_waf" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "price_class" {
  type        = string
  description = "CloudFront price class: PriceClass_100 | PriceClass_200 | PriceClass_All"
  default     = "PriceClass_100"
}

variable "hsts_max_age_sec" {
  type        = number
  description = "HSTS max-age in seconds (e.g. 31536000 = 1 year)."
  default     = 31536000
}

variable "hsts_include_subdomains" {
  type        = bool
  description = "HSTS includeSubDomains. Set true only if all subdomains of your custom domain use HTTPS."
  default     = false
}

variable "hsts_preload" {
  type        = bool
  description = "HSTS preload flag. Requires includeSubdomains and registration at hstspreload.org."
  default     = false
}

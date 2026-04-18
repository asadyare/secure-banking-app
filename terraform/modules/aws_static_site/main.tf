locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

locals {
  bucket_id         = coalesce(var.bucket_name, "${local.name_prefix}-site-${random_id.bucket_suffix.hex}")
  use_custom_domain = var.domain_name != null && var.acm_certificate_arn != null
}

resource "aws_s3_bucket" "site" {
  bucket = local.bucket_id

  tags = merge(var.tags, {
    Name = local.bucket_id
  })
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${local.name_prefix}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Aligns with docker/nginx/default.conf + security assessment (HSTS, Permissions-Policy).
resource "aws_cloudfront_response_headers_policy" "spa" {
  name = "${local.name_prefix}-spa-security-headers"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = var.hsts_max_age_sec
      include_subdomains         = var.hsts_include_subdomains
      preload                    = var.hsts_preload
      override                   = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
      override = true
    }
  }
}

# With a custom ACM cert the viewer_certificate block below pins
# minimum_protocol_version to TLSv1.2_2021. Without one (local/dev), AWS
# only accepts `TLSv1` alongside the default *.cloudfront.net cert, so the
# null branch is an AWS API constraint rather than a policy choice. Semgrep
# cannot distinguish the two conditional branches at analysis time, so
# suppress the rule on the resource it matches against.
# nosemgrep: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} SPA"
  default_root_object = "index.html"
  price_class         = var.price_class

  aliases = local.use_custom_domain ? [var.domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "S3-${local.bucket_id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${local.bucket_id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.spa.id
    min_ttl                    = 0
    default_ttl                = 3600
    max_ttl                    = 86400
    compress                   = true
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.use_custom_domain
    acm_certificate_arn            = local.use_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
    # Custom domain path enforces TLSv1.2_2021 (modern). With the default
    # *.cloudfront.net certificate AWS rejects anything other than `TLSv1`
    # (or empty), so the null branch is an AWS API constraint, not a policy
    # choice.
    minimum_protocol_version = local.use_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = var.tags

  depends_on = [
    aws_s3_bucket_public_access_block.site,
  ]
}

resource "aws_wafv2_web_acl" "cloudfront" {
  count    = var.enable_waf ? 1 : 0
  provider = aws.us_east_1

  name        = "${local.name_prefix}-waf"
  description = "Managed rules for ${local.name_prefix} CloudFront"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name_prefix}-badinputs"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_wafv2_web_acl_association" "site" {
  count        = var.enable_waf ? 1 : 0
  provider     = aws.us_east_1
  resource_arn = aws_cloudfront_distribution.site.arn
  web_acl_arn  = aws_wafv2_web_acl.cloudfront[0].arn
}

data "aws_iam_policy_document" "s3_cloudfront" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.s3_cloudfront.json

  depends_on = [aws_cloudfront_distribution.site]
}

resource "aws_route53_record" "app" {
  count   = local.use_custom_domain && var.hosted_zone_id != null ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

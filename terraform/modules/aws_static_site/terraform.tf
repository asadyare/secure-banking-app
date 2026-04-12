terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Default regional provider + us-east-1 for WAF / ACM used by CloudFront
      configuration_aliases = [aws.us_east_1]
    }
    random = {
      source = "hashicorp/random"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# CloudFront certificates must live in us-east-1; WAF for CloudFront is also us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

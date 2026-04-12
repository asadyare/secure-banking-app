terraform {
  required_version = ">= 1.5.0"

  # Remote state: supply bucket/key/region/table via `terraform init -backend-config=...`
  # See backend-config.example.hcl and docs/github-oidc-aws.md
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
      
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
    
  }
}

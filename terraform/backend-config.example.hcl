# Copy to backend-config.secrets.hcl (gitignored) and edit.
# region MUST match the S3 bucket's actual AWS region (see bucket properties in console).

bucket         = "your-terraform-state-bucket"
key            = "baawisan-bank/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "terraform-locks"

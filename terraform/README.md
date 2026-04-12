# AWS infrastructure (Terraform)

Deploys a **private S3 bucket** + **CloudFront** (Origin Access Control) for the Vite/React SPA. Optional **Route53 alias**, **ACM TLS**, and **AWS WAF** (managed rules, `us-east-1`).

Supabase remains **outside** this stack (configure `VITE_SUPABASE_*` at build time).

## Prerequisites

- Terraform `>= 1.5`
- AWS credentials (`aws configure` or environment variables)
- For custom domain: **ACM certificate in `us-east-1`** (CloudFront requirement) and a Route53 public hosted zone

## Quick start

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars

# Remote state (recommended): copy backend-config.example.hcl → backend-config.secrets.hcl, edit, then:
terraform init -backend-config=backend-config.secrets.hcl

# Or one-shot init:
terraform init -backend-config="bucket=YOUR_BUCKET" -backend-config="key=baawisan-bank/terraform.tfstate" \
  -backend-config="region=eu-west-1" -backend-config="dynamodb_table=YOUR_LOCK_TABLE" -backend-config="encrypt=true"

terraform plan
terraform apply
```

`versions.tf` declares `backend "s3" {}`; all bucket/key/region/table values are supplied at `init` time (local file or CI secrets).

After apply:

```bash
cd ..
npm run build
aws s3 sync dist/ s3://$(terraform -chdir=terraform output -raw s3_bucket_id) --delete
aws cloudfront create-invalidation --distribution-id $(terraform -chdir=terraform output -raw cloudfront_distribution_id) --paths "/*"
```

(On Windows, use PowerShell equivalents or run outputs manually from `terraform output`.)

## Module layout

| Path | Purpose |
|------|---------|
| `modules/aws_static_site/` | Reusable module: S3, CloudFront OAC, optional WAF + DNS |
| Root `.tf` files | Example wiring + variables |

## Variables (root)

See `variables.tf` and `terraform.tfvars.example`.

- **`enable_waf`** — Attaches WAFv2 (CLOUDFRONT scope) with AWS managed rule groups in **us-east-1**.
- **Custom domain** — Set `domain_name`, `hosted_zone_id`, and `acm_certificate_arn` together. Omit all three to use the default `*.cloudfront.net` name.
- **Response headers** — CloudFront uses a managed **response headers policy** on the default behavior: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, **Strict-Transport-Security** (defaults: `max-age=31536000`), and **Permissions-Policy** (restrictive defaults). Tune `hsts_max_age_sec`, `hsts_include_subdomains`, and `hsts_preload` in `terraform.tfvars` when using a custom domain.

## State backend (recommended)

For teams, use **S3 + DynamoDB** locking. Example `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "baawisan-bank/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

Create the bucket and table first, then `terraform init -migrate-state`.

## CI/CD (GitHub Actions + OIDC)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/terraform.yml` | PR / push / `workflow_dispatch` | `fmt`, `validate`, `plan`; **apply** only when you run workflow manually and enable **terraform_apply** |
| `.github/workflows/deploy-frontend.yml` | Push to `main` (app paths) / manual | `npm ci`, `npm run build`, `aws s3 sync`, CloudFront invalidation |

**Secrets (repository):**

- `AWS_ROLE_ARN` — IAM role trusted by GitHub OIDC (Terraform + can double as deploy if policy allows)
- `TF_STATE_BUCKET`, `TF_LOCK_TABLE` — remote state
- `TF_STATE_KEY` — optional; defaults to `baawisan-bank/terraform.tfstate` in the workflow
- `TERRAFORM_TFVARS` — optional multiline file content for `terraform.tfvars` in CI
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — for the build
- `S3_BUCKET_ID`, `CLOUDFRONT_DISTRIBUTION_ID` — website bucket and distribution (from `terraform output`)
- `AWS_DEPLOY_ROLE_ARN` — optional; narrow role for deploy only; if unset, deploy uses `AWS_ROLE_ARN`

IAM setup: **`docs/github-oidc-aws.md`**.

Least privilege for deploy: `s3:PutObject`/`DeleteObject`/`ListBucket` on the website bucket; `cloudfront:CreateInvalidation` on the distribution.

## Costs (indicative)

S3 + CloudFront + optional WAF incur AWS charges. Use Cost Explorer and budgets.

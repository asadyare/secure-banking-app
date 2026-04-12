# GitHub Actions → AWS (OIDC)

Use **OpenID Connect** so GitHub Actions can assume an IAM role **without** storing AWS access keys in GitHub.

## 1. Create the OIDC provider (once per AWS account)

If you do not already have `token.actions.githubusercontent.com`:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

(Thumbprint can change; see [AWS docs](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) for the current value.)

## 2. S3 backend for Terraform state (recommended before CI apply)

1. Create an S3 bucket (e.g. `your-company-terraform-state`) with **versioning** enabled and **encryption**.
2. Create a DynamoDB table for state locking, e.g. `terraform-locks`, partition key `LockID` (String).
3. Block public access on the state bucket.

Local init:

```bash
cd terraform
cp backend-config.example.hcl backend-config.secrets.hcl
# Edit bucket/key/region/table
terraform init -backend-config=backend-config.secrets.hcl
```

## 3. IAM trust policy for GitHub (replace placeholders)

| Placeholder | Value |
|-------------|--------|
| `ACCOUNT_ID` | Your AWS account ID |
| `GITHUB_ORG` | GitHub org or user name |
| `GITHUB_REPO` | Repository name |

Restrict `sub` to your repo and optionally to `ref:refs/heads/main` only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GitHubActions",
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:GITHUB_ORG/GITHUB_REPO:*"
        }
      }
    }
  ]
}
```

Stricter (main branch only):

```json
"token.actions.githubusercontent.com:sub": "repo:GITHUB_ORG/GITHUB_REPO:ref:refs/heads/main"
```

## 4. IAM permissions for the Terraform role

Attach policies that allow:

**State backend (minimum):**

- `s3:ListBucket` on the state bucket
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::BUCKET/*`
- `dynamodb:GetItem`, `PutItem`, `DeleteItem` on the lock table ARN

**Terraform apply** — same permissions your human operators use to create S3, CloudFront, WAF, Route53, IAM passthrough, etc. Start with **scoped** policies per resource type in production; a **sandbox** account may use broader policies for learning.

## 5. IAM permissions for frontend deploy (optional second role)

Least privilege for `aws s3 sync` + CloudFront invalidation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SyncWebsiteBucket",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::YOUR_WEBSITE_BUCKET",
        "arn:aws:s3:::YOUR_WEBSITE_BUCKET/*"
      ]
    },
    {
      "Sid": "InvalidateCloudFront",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution"],
      "Resource": "*"
    }
  ]
}
```

Replace `YOUR_WEBSITE_BUCKET` and tighten `cloudfront:CreateInvalidation` to the distribution ARN when known.

## 6. GitHub repository secrets

| Secret | Used by |
|--------|---------|
| `AWS_ROLE_ARN` | Terraform workflow — role ARN to assume |
| `TF_STATE_BUCKET` | Terraform — state bucket name |
| `TF_STATE_KEY` | Optional; default in workflow is `baawisan-bank/terraform.tfstate` |
| `TF_LOCK_TABLE` | DynamoDB lock table name |
| `AWS_REGION` | Optional; defaults to `eu-west-1` in workflows |
| `TERRAFORM_TFVARS` | Optional multiline — full `terraform.tfvars` for `terraform plan/apply` in CI |
| `AWS_DEPLOY_ROLE_ARN` | Deploy workflow — if empty, falls back to `AWS_ROLE_ARN` |
| `S3_BUCKET_ID` | Website bucket name (from `terraform output`) |
| `CLOUDFRONT_DISTRIBUTION_ID` | From `terraform output` |
| `VITE_SUPABASE_URL` | Build-time env for Vite |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build-time env for Vite |

Fork PRs: GitHub does not pass secrets to workflows from forks unless you change settings; keep `terraform plan` on trusted branches only or use `pull_request_target` with extreme care.

## 7. AWS account mapping

In the IAM role, set **session tags** or **external ID** only if you need multi-account; OIDC alone maps one role per repo/branch pattern.

---

*See `.github/workflows/terraform.yml` and `deploy-frontend.yml` for exact env usage.*

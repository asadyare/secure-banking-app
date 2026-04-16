# Deploy to AWS (Terraform + static frontend)

You chose **S3 + CloudFront** (Terraform) for production. Use this checklist in order so infrastructure exists before CI pushes the built SPA.

---

## 1. One-time: Terraform backend

Create (or reuse) an **S3 bucket** (versioning + encryption) and a **DynamoDB** table for state locking. Then:

```bash
cd terraform
cp backend-config.example.hcl backend-config.secrets.hcl
# Edit: bucket, key, region, dynamodb_table

terraform init -backend-config=backend-config.secrets.hcl
```

See `terraform/README.md` for details.

---

## 2. Configure variables

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit **`terraform.tfvars`**: `project_name`, `environment`, `aws_region`, optional **custom domain** (`domain_name`, `hosted_zone_id`, `acm_certificate_arn` in **us-east-1**), `enable_waf`, and **HSTS** vars if you use a custom domain.

---

## 3. Plan and apply

```bash
cd terraform
terraform plan
terraform apply
```

Save outputs you need next:

```bash
terraform output -raw s3_bucket_id
terraform output -raw cloudfront_distribution_id
terraform output -raw cloudfront_url
```

---

## 4. Supabase (before first real traffic)

In **Supabase → Authentication → URL configuration**:

- **Site URL** — your CloudFront URL or custom domain (HTTPS).
- **Redirect URLs** — same + `http://localhost:8080` (or your dev port) if you still develop locally.

Redeploy the frontend after changing Supabase URLs if needed.

---

## 5. GitHub repository secrets (CI deploy)

The workflow **Deploy frontend** (`.github/workflows/deploy-frontend.yml`) builds with Vite and syncs to S3. Configure secrets in the repo (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL (HTTPS) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key |
| `S3_BUCKET_ID` | Output `s3_bucket_id` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Output `cloudfront_distribution_id` |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for **deploy only** (recommended), *or* leave unset and set `AWS_ROLE_ARN` if that role can sync S3 + invalidate CloudFront |

**OIDC:** The deploy role must trust GitHub Actions (`sts:AssumeRoleWithWebIdentity`) and allow `s3:PutObject`/`DeleteObject`/… on the website bucket and `cloudfront:CreateInvalidation` on your distribution. See **[docs/github-oidc-aws.md](github-oidc-aws.md)** §5–6.

**Region:** Workflows use **`us-east-1`** (`terraform.yml`, `deploy-frontend.yml`). Keep this aligned with your Terraform `aws_region`, state bucket region, and `terraform init` backend `region`. If your resources live in another region, change the workflow `AWS_REGION` and backend config together.

---

## 6. First deploy (choose one)

### A. Let GitHub Actions deploy

Merge to **`main`** with changes under paths the workflow watches (`src/**`, `package.json`, etc.), or run **Actions → Deploy frontend → Run workflow**.

### B. Manual deploy from your machine

With AWS credentials that can sync the bucket and invalidate CloudFront:

```bash
npm ci
npm run build
aws s3 sync dist/ "s3://YOUR_BUCKET_ID/" --delete --region us-east-1
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## 7. Verify

- Open **`cloudfront_url`** (or your custom domain) over **HTTPS**.
- Sign in, exercise transfers, and confirm **RLS** behavior in Supabase.
- Optional: response headers (HSTS, frame deny) via browser devtools → Network → document request.

---

## 8. Ongoing operations

- **Infrastructure changes:** `terraform plan` / `apply` in `terraform/`.
- **App updates:** push to `main` (or manual workflow) so the deploy workflow rebuilds and syncs.
- **Secrets:** Rotate Supabase keys in GitHub if compromised; rebuild and redeploy.

---

## Related docs

- [terraform/README.md](../terraform/README.md) — Terraform usage, variables, outputs  
- [github-oidc-aws.md](github-oidc-aws.md) — OIDC trust and IAM for Terraform + deploy  
- [deployment-comparison.md](deployment-comparison.md) — Why static hosting fits this app  
- [security-pre-deployment-assessment.md](security-pre-deployment-assessment.md) — Security checklist  

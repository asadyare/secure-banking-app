# Incident 17 — Terraform init blew up on empty backend secrets

## Symptom

Once the Terraform workflow could actually assume the role (fix from [incident 15](15-terraform-oidc-pr-trust.md)), it immediately failed on backend init:

```
Run set -euo pipefail
Initializing the backend...
Initializing modules...
- static_site in modules/aws_static_site
╷
│ Error: Invalid Value
│
│   on versions.tf line 6, in terraform:
│    6:   backend "s3" {}
│
│ The value cannot be empty or all whitespace
╵
Error: Process completed with exit code 1.
```

## Root cause

The Terraform backend block is empty in HCL (`backend "s3" {}`) and gets its bucket/region/table from `-backend-config=...` flags or environment variables at init time. The workflow constructed those flags from the `TF_STATE_BUCKET` and `TF_LOCK_TABLE` GitHub secrets — which were **not set** on this repository. Terraform received `-backend-config="bucket="` and refused.

This is the same class of problem as [incident 18](18-deploy-missing-aws-targets.md) in the deploy workflow: a job that assumes its prerequisites were done out-of-band, and face-plants when they weren't.

## Fix

Add a **preflight** step at the top of the Terraform workflow that checks the two backend secrets are non-empty. If either is missing, log a friendly warning to the job summary and skip the rest of the job — instead of crashing on `terraform init`.

```yaml
- name: Check backend secrets
  id: backend
  env:
    TF_STATE_BUCKET: ${{ secrets.TF_STATE_BUCKET }}
    TF_LOCK_TABLE:  ${{ secrets.TF_LOCK_TABLE }}
  run: |
    set -euo pipefail
    missing=()
    [ -z "${TF_STATE_BUCKET:-}" ] && missing+=("TF_STATE_BUCKET")
    [ -z "${TF_LOCK_TABLE:-}" ]   && missing+=("TF_LOCK_TABLE")
    if [ "${#missing[@]}" -gt 0 ]; then
      {
        echo "### Terraform skipped"
        echo ""
        echo "Required backend secret(s) not configured: \`${missing[*]}\`."
        echo ""
        echo "Create the S3 remote-state bucket and the DynamoDB lock table, "
        echo "then add the secrets under **Settings → Secrets and variables → Actions**. "
        echo "See [docs/github-oidc-aws.md](../blob/${GITHUB_SHA}/docs/github-oidc-aws.md)."
      } >> "$GITHUB_STEP_SUMMARY"
      echo "::warning::Terraform backend secrets not set (${missing[*]}); skipping init/plan/apply."
      echo "configured=false" >> "$GITHUB_OUTPUT"
    else
      echo "configured=true" >> "$GITHUB_OUTPUT"
    fi

- name: Configure AWS (OIDC)
  if: steps.backend.outputs.configured == 'true'
  uses: aws-actions/configure-aws-credentials@v4
  ...

- name: Terraform init
  if: steps.backend.outputs.configured == 'true'
  run: terraform init -backend-config="bucket=${{ secrets.TF_STATE_BUCKET }}" ...
```

Also reordered `Terraform fmt (check)` to run *before* credential configuration, so an HCL format miss fails the job cheaply without touching OIDC.

PR [#21](https://github.com/asadyare/secure-banking-app/pull/21) — *ci(terraform): preflight remote-backend secrets before init* — merged as [`53b5e2d`](https://github.com/asadyare/secure-banking-app/commit/53b5e2d).

## Proof

- On repos without the backend secrets set, the Terraform workflow now **passes** with a clear "Terraform skipped" summary and an `::warning::` annotation. No more mid-init crashes.
- Once the two secrets are populated, the same workflow runs init/plan/apply unchanged.

## Screenshot slot

`shot-list.md` entry **S-14** — a `Terraform` workflow run page showing the "Terraform skipped" summary panel with the actionable guidance text.

## Lessons

- **Preflight your prerequisites.** A workflow that depends on external state (secrets, AWS resources, third-party endpoints) should validate that state before acting on it, and produce a readable summary when it cannot.
- Job summaries (`$GITHUB_STEP_SUMMARY`) are the right place for operator-facing guidance. They render as markdown and persist next to the run; `echo` to stdout disappears in the log noise.
- Put credential-free steps (`fmt`, `validate`, secret-presence checks) before the OIDC step. If a PR breaks HCL formatting you want to tell them in 10 seconds, not after an STS round-trip.

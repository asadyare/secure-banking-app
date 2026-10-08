# Incident 18 — `aws s3 sync` crashed mid-operation with `NoSuchBucket`

## Symptom

The deploy-frontend workflow successfully assumed the AWS role, built the SPA, then crashed on the first `aws` call:

```
Run aws s3 sync dist/ "s3://${BUCKET}/" --delete
fatal error: An error occurred (NoSuchBucket) when calling the
ListObjectsV2 operation: The specified bucket does not exist
Error: Process completed with exit code 1.
```

## Root cause

Two overlapping causes:

1. `S3_BUCKET_ID` / `CLOUDFRONT_DISTRIBUTION_ID` were either unset, stale, or pointing at a bucket/distribution that had been destroyed and recreated. `aws s3 sync` happily tried to list objects anyway and crashed at the first HTTP call.
2. There was **no sanity check** between "OIDC assumed" and "start mutating S3". The failure mode was a mid-sync crash instead of a readable "targets missing" summary.

Same class of problem as [incident 17](17-terraform-backend-secrets.md) — a job that does not validate its preconditions before acting.

## Fix

Two-stage preflight in [deploy-frontend.yml](../../../.github/workflows/deploy-frontend.yml):

### Stage 1 — secrets presence (before OIDC)

```yaml
- name: Check deploy secrets
  id: secrets_check
  env:
    ROLE_ARN: ${{ secrets.AWS_DEPLOY_ROLE_ARN || secrets.AWS_ROLE_ARN }}
    BUCKET:   ${{ secrets.S3_BUCKET_ID }}
    DIST_ID:  ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
  run: |
    set -euo pipefail
    missing=()
    [ -z "${ROLE_ARN:-}" ] && missing+=("AWS_DEPLOY_ROLE_ARN or AWS_ROLE_ARN")
    [ -z "${BUCKET:-}" ]   && missing+=("S3_BUCKET_ID")
    [ -z "${DIST_ID:-}" ]  && missing+=("CLOUDFRONT_DISTRIBUTION_ID")
    if [ "${#missing[@]}" -gt 0 ]; then
      echo "::warning::Deploy secrets not set (${missing[*]}); skipping AWS deploy."
      echo "secrets_ok=false" >> "$GITHUB_OUTPUT"
    else
      echo "secrets_ok=true" >> "$GITHUB_OUTPUT"
    fi
```

### Stage 2 — target reachability (after OIDC)

```yaml
- name: Verify deploy targets exist
  id: targets_check
  if: steps.secrets_check.outputs.secrets_ok == 'true'
  env:
    BUCKET:  ${{ secrets.S3_BUCKET_ID }}
    DIST_ID: ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}
  run: |
    set -uo pipefail
    problems=()
    if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
      problems+=("S3 bucket \`${BUCKET}\` not found or inaccessible")
    fi
    if ! aws cloudfront get-distribution --id "${DIST_ID}" >/dev/null 2>&1; then
      problems+=("CloudFront distribution \`${DIST_ID}\` not found or inaccessible")
    fi
    if [ "${#problems[@]}" -gt 0 ]; then
      # write job summary + ::warning::
      echo "targets_ok=false" >> "$GITHUB_OUTPUT"
    else
      echo "targets_ok=true" >> "$GITHUB_OUTPUT"
    fi

- name: Sync to S3
  if: steps.targets_check.outputs.targets_ok == 'true'
  ...
- name: Invalidate CloudFront
  if: steps.targets_check.outputs.targets_ok == 'true'
  ...
```

PR [#22](https://github.com/asadyare/secure-banking-app/pull/22) — *ci(deploy-frontend): preflight deploy targets before S3 sync* — merged as [`8b3124a`](https://github.com/asadyare/secure-banking-app/commit/8b3124a).

## Proof

- Runs without the deploy stack provisioned now pass with a clear "Frontend deploy skipped" summary and a warning annotation — no more mid-sync crashes.
- This preflight is what surfaced the **real** next problem in [incident 19](19-deploy-iam-permissions-gap.md): `head-bucket` returning 403 because the role lacked S3 permissions. The preflight was the correct diagnostic layer — `NoSuchBucket` mid-sync would have hidden the IAM issue.

## Screenshot slot

`shot-list.md` entry **S-15** — a `Deploy frontend (CD pipeline)` workflow-run page where targets are missing, showing the "Frontend deploy skipped" summary panel.

## Lessons

- **Preflight target reachability, not just secret presence.** Secrets being set just means someone typed a value into a form — it says nothing about whether the value points at a real, reachable resource.
- `aws s3api head-bucket` and `aws cloudfront get-distribution` are cheap (single GET, no side effects) and perfect for this. They also differentiate **`403 Forbidden`** (resource exists, permission missing) from **`404 NoSuchBucket`** (wrong name) — a distinction that turned out to matter in incident 19.
- Write job summaries targeted at **operators**, not developers. The message should tell them what secret to set or what to `terraform apply`, not dump a stack trace.

# 04 — CI/CD pipeline

Four workflows, each with a specific role and explicitly-scoped permissions.

## Workflows at a glance

| File | Role | Triggers | Writes to AWS? |
|---|---|---|---|
| [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | Per-push / per-PR quality + security gate | `push`, `pull_request` | No |
| [.github/workflows/secret-scan.yml](../../.github/workflows/secret-scan.yml) | Verified-only secret scanning | `push`, `pull_request`, `schedule` | No |
| [.github/workflows/terraform.yml](../../.github/workflows/terraform.yml) | Apply IaC to AWS | `push` to protected branches, `workflow_dispatch` | Yes (OIDC) |
| [.github/workflows/deploy-frontend.yml](../../.github/workflows/deploy-frontend.yml) | Build SPA, sync to S3, invalidate CloudFront | `push` to `main`, `workflow_dispatch` | Yes (OIDC) |

## Gating: branch ruleset on `main`

The `main` branch has a GitHub repository ruleset that requires **all** of the following status checks to be green before merge:

- `Lint, test, build, npm audit`
- `Dependency Review`
- `Gitleaks`
- `Trivy (filesystem)`
- `Trivy`
- `Terraform fmt & validate`
- `Checkov (Terraform)`
- `Semgrep`
- `CodeQL` (from default setup)
- `OWASP ZAP (baseline DAST)`
- `TruffleHog`
- `Analyze (actions)`, `Analyze (javascript-typescript)`, `Analyze (python)` (CodeQL default-setup jobs)

The ruleset is why every fix in the [incident log](05-incident-log.md) went through a PR rather than a direct push to `main` — the ruleset also demands a CodeQL result on the tip commit, which is only achievable via a PR.

## Permissions model (least privilege per job)

Each job declares its own `permissions:` block rather than inheriting repository defaults. Examples:

```yaml
# ci.yml — Lint, test, build, npm audit
permissions:
  contents: read

# ci.yml — Trivy (SARIF upload)
permissions:
  contents: read
  security-events: write
  actions: read          # required by upload-sarif to read workflow-run metadata

# ci.yml — Dependency Review
permissions:
  contents: read
  pull-requests: write   # to comment on the PR

# terraform.yml / deploy-frontend.yml — OIDC-assuming jobs
permissions:
  id-token: write        # required to mint a GitHub OIDC JWT
  contents: read
```

No workflow has repository-level write permissions beyond what each job explicitly requests.

## Supply-chain hardening

- Every third-party action is pinned to a **full commit SHA** with a `# vX.Y.Z` comment next to it (not a floating `@vX` tag). Fixes for cases where this mattered in practice:
  - Trivy: [incident 07](06-incidents/07-trivy-action-tag.md).
  - TruffleHog: [incident 16](06-incidents/16-trufflehog-action-tag.md).
- `actions/upload-artifact@v4` and `actions/download-artifact@v4` (v3 deprecated).
- `github/codeql-action/upload-sarif@v4` (v3 deprecated mid-project, upgraded in [incident 08](06-incidents/08-trivy-sarif-permissions.md)).
- Node 20 → Node 24 migration bridged via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in workflow `env` until upstream actions ship a Node 24 major (PR [#20](https://github.com/asadyare/secure-banking-app/pull/20)).

## Preflight pattern

Both AWS-touching workflows use a **preflight** pattern: check prerequisites, and if any are missing, log an actionable warning into the job summary and skip downstream steps — rather than letting the job crash mid-operation. This is what lets a freshly-forked repo run the workflows to completion without needing the full AWS stack provisioned.

### Terraform preflight

```yaml
- name: Check backend secrets
  id: backend
  env:
    TF_STATE_BUCKET: ${{ secrets.TF_STATE_BUCKET }}
    TF_LOCK_TABLE:  ${{ secrets.TF_LOCK_TABLE }}
  run: |
    missing=()
    [ -z "${TF_STATE_BUCKET:-}" ] && missing+=("TF_STATE_BUCKET")
    [ -z "${TF_LOCK_TABLE:-}" ]   && missing+=("TF_LOCK_TABLE")
    if [ "${#missing[@]}" -gt 0 ]; then
      echo "::warning::Terraform backend secrets not set; skipping init/plan/apply."
      echo "configured=false" >> "$GITHUB_OUTPUT"
    else
      echo "configured=true" >> "$GITHUB_OUTPUT"
    fi

- name: Configure AWS (OIDC)
  if: steps.backend.outputs.configured == 'true'
  uses: aws-actions/configure-aws-credentials@v4
  ...
```

Full motivation in [incident 17](06-incidents/17-terraform-backend-secrets.md).

### Deploy preflight (two-stage)

The deploy workflow goes further — it verifies secrets **and** then verifies the AWS resources the secrets refer to actually exist and are reachable:

```yaml
- name: Check deploy secrets
  id: secrets_check
  ...

- name: Configure AWS (OIDC)
  if: steps.secrets_check.outputs.secrets_ok == 'true'
  ...

- name: Verify deploy targets exist
  id: targets_check
  if: steps.secrets_check.outputs.secrets_ok == 'true'
  run: |
    bucket_out=$(aws s3api head-bucket --bucket "${BUCKET}" 2>&1); bucket_rc=$?
    dist_out=$(aws cloudfront get-distribution --id "${DIST_ID}" 2>&1); dist_rc=$?
    if [ "${bucket_rc}" -ne 0 ] || [ "${dist_rc}" -ne 0 ]; then
      echo "targets_ok=false" >> "$GITHUB_OUTPUT"
      # summary + warning ...
    else
      echo "targets_ok=true" >> "$GITHUB_OUTPUT"
    fi

- name: Sync to S3
  if: steps.targets_check.outputs.targets_ok == 'true'
  ...
```

This is the step that eventually surfaced the IAM permissions gap in [incident 19](06-incidents/19-deploy-iam-permissions-gap.md) — the preflight returned `AccessDenied` instead of a mid-sync `NoSuchBucket`, so the failure mode was an actionable summary, not a partial deploy.

## OIDC-to-AWS flow (operational)

1. Workflow job declares `permissions: id-token: write`.
2. `aws-actions/configure-aws-credentials@v4` requests an OIDC JWT from `token.actions.githubusercontent.com` with `audience=sts.amazonaws.com`.
3. The action calls `sts:AssumeRoleWithWebIdentity` against the IAM role ARN stored in `AWS_ROLE_ARN` / `AWS_DEPLOY_ROLE_ARN`.
4. AWS verifies the JWT against the IAM OIDC provider and checks the role's trust policy (subject/audience/repo/ref). On match, STS returns short-lived credentials (≤ 1 h).
5. Subsequent `aws` CLI calls in the job use those credentials. The role's **inline policy** is where the action-level authorisation happens:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "S3SyncBucket",  "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::BUCKET" },
    { "Sid": "S3SyncObjects", "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::BUCKET/*" },
    { "Sid": "CloudFrontInvalidate", "Effect": "Allow",
      "Action": ["cloudfront:GetDistribution", "cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::ACCOUNT:distribution/DIST_ID" }
  ]
}
```

Exact bootstrap steps (IAM OIDC provider, trust policy, first-time apply) live in [docs/github-oidc-aws.md](../github-oidc-aws.md).

## Dependabot policy

- Grouped updates for Radix UI, @types/*, and GitHub Actions.
- Every Dependabot PR runs the full ruleset gate — no auto-merge for security-sensitive bumps; only low-risk groups (types, lint plugins) are auto-merged via a follow-up workflow.
- Open Dependabot PRs at time of writing (`#3`, `#4`, `#5`, `#6`, `#8`, `#9`, `#10`, `#11`, `#12`, `#13`, `#14`, `#15`, `#16`, `#17`) are triaged manually; the case study focuses on the security-debug journey rather than the routine bump cadence.

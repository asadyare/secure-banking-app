# Incident 19 — Deploy role had no S3 or CloudFront permissions (and the scaffolding policy had unsubstituted placeholders)

This was the last blocker before the first successful end-to-end deploy. It spanned three sub-issues over multiple workflow runs, so it is documented in detail.

## Symptom

After the preflight ([incident 18](18-deploy-missing-aws-targets.md)) was in place, deploys were still skipping. The first diagnostic pass showed the preflight passing for secrets but failing for targets — with **empty stderr**, which is unusual:

```
head-bucket failed:
get-distribution failed:
::warning::Deploy targets missing; skipping S3 sync and CloudFront invalidation.
```

Empty stderr with a non-zero exit code meant the capture pattern itself was wrong: the redirect order swallowed the error message before we could see it.

## Root cause (three layers)

### Layer 1 — the preflight captured stderr incorrectly

```bash
# what we had:
bucket_err=$(aws s3api head-bucket --bucket "${BUCKET}" 2>&1 >/dev/null)
```

The redirect order `2>&1 >/dev/null` in the context of `$(...)` captured stderr correctly *in theory*, but AWS CLI v2 prints its errors to stderr in a format that the subshell's capture was interacting with in unintended ways in our runner. The empty-string capture masked the real problem.

### Layer 2 — the deploy role had zero S3 / CloudFront permissions

With a beefed-up diagnostic preflight (PRs [#24](https://github.com/asadyare/secure-banking-app/pull/24), [#25](https://github.com/asadyare/secure-banking-app/pull/25)) that also printed `aws sts get-caller-identity`, `aws s3api list-buckets`, and `aws cloudfront list-distributions`, the actual picture emerged:

```
head-bucket          -> 403 Forbidden
get-distribution     -> AccessDenied (cloudfront:GetDistribution)
list-buckets         -> AccessDenied (s3:ListAllMyBuckets)
list-distributions   -> AccessDenied (cloudfront:ListDistributions)

Caller: arn:aws:sts::733366528696:assumed-role/AWS_ROLE_ARN/GitHubActions
```

OIDC worked end-to-end — the role was assumed successfully. The **role itself had no identity-based policy granting any S3 or CloudFront action**. The trust policy was correct (incident 15); the permissions were empty.

`head-bucket` returning **403** rather than 404 is the telling detail: the bucket existed, but the role could not see it (AWS deliberately returns 403 rather than 404 on missing permissions to avoid leaking resource existence).

### Layer 3 — the inline policy went in with unsubstituted placeholders

When the operator attached the fix policy, the first attempt copy-pasted the scaffolding verbatim — including `<paste-your-S3_BUCKET_ID-value>` and `<paste-your-CLOUDFRONT_DISTRIBUTION_ID-value>` in the `Resource` fields. IAM accepted the `put-role-policy` call (those are syntactically valid ARNs), but the policy granted access to a bucket literally named `<paste-your-S3_BUCKET_ID-value>` — which does not exist. Preflight kept returning 403.

`aws iam get-role-policy --role-name AWS_ROLE_ARN --policy-name deploy-frontend` showed the literal placeholders in the stored document, which made the diagnosis instant.

## Fix

Inline policy scoped to the exact bucket and distribution, re-applied with real values substituted:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "S3SyncBucket",   "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::<REAL-BUCKET-NAME>" },
    { "Sid": "S3SyncObjects",  "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<REAL-BUCKET-NAME>/*" },
    { "Sid": "CloudFrontInvalidate", "Effect": "Allow",
      "Action": ["cloudfront:GetDistribution", "cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::733366528696:distribution/<REAL-DIST-ID>" }
  ]
}
```

Attached via `aws iam put-role-policy --role-name AWS_ROLE_ARN --policy-name deploy-frontend --policy-document file://deploy-frontend-policy.json`.

Workflow-side, the preflight was progressively hardened:

- PR [#24](https://github.com/asadyare/secure-banking-app/pull/24) — capture stderr from `head-bucket` / `get-distribution` and include it in the job summary ([`d9aa058`](https://github.com/asadyare/secure-banking-app/commit/d9aa058)).
- PR [#25](https://github.com/asadyare/secure-banking-app/pull/25) — deep diagnostics: also print caller identity, secret-value lengths, full stderr+stdout with exit code, and `list-buckets` / `list-distributions` sanity checks ([`b683c34`](https://github.com/asadyare/secure-banking-app/commit/b683c34)).

## Proof

First successful end-to-end deploy on workflow run [`24605611658`](https://github.com/asadyare/secure-banking-app/actions/runs/24605611658):

```
SUCCESS   Verify deploy targets exist     (head-bucket exit=0, get-distribution exit=0)
SUCCESS   Sync to S3                      (6 objects uploaded)
SUCCESS   Invalidate CloudFront           (invalidation created)
```

Object list uploaded: `index.html`, `favicon.svg`, `placeholder.svg`, `robots.txt`, `assets/index-DKnqn_51.css`, `assets/index-1ZHJHJfN.js`.

The preflight also confirmed the distribution's `CallerReference` was `terraform-20260418094443810600000001` — proving the `CLOUDFRONT_DISTRIBUTION_ID` secret was pointing at the Terraform-managed distribution, not a stale one.

## Screenshot slot

- `shot-list.md` entry **S-01** — live CloudFront URL loading in a browser (the payoff shot).
- `shot-list.md` entry **S-02** — DevTools Network panel on the same URL, confirming `Strict-Transport-Security`, `Content-Security-Policy`, and the rest are set by CloudFront.
- `shot-list.md` entry **S-16** — AWS IAM Console → Roles → `AWS_ROLE_ARN` → Permissions tab, showing the inline `deploy-frontend` policy with real ARNs.
- `shot-list.md` entry **S-17** — the green "Deploy frontend (CD pipeline)" run with Sync + Invalidate both `SUCCESS`.

## Lessons

- **OIDC success ≠ authorisation success.** A role that can be assumed may still have an empty permission set. Always smoke-test with a `head-bucket` / `get-distribution` style no-op before the first mutating call.
- **403 vs 404 is a signal.** `head-bucket` specifically returns 403 when the bucket exists but you lack permission, 404 when it does not. Reading that correctly saved hours on this one.
- **Template placeholders in IAM documents are a live hazard.** `put-role-policy` does not validate that `Resource` ARNs refer to real resources. Always follow up with `get-role-policy` and `grep -E '<[a-z-]+>'` to catch unsubstituted placeholders.
- **Keep diagnostic preflights capability-only, not permission-dependent.** The preflight survived the policy gap (it has no permissions either, but it executes with the same role) precisely because its failure mode was "log the error, skip the deploy" — not "crash and burn".
- **Document the IAM policy shape in the repo.** This case study now serves as the canonical reference for future deploys; there is no more "figure out what the role needs" archaeology to do.

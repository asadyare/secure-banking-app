# Incident 13 — Semgrep flagged "insecure CloudFront TLS" on a conditional branch

## Symptom

```
Semgrep rule: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
  Severity: ERROR
  Detected an AWS CloudFront Distribution with an insecure TLS version.
  terraform/modules/aws_static_site/main.tf
    resource "aws_cloudfront_distribution" "site" { ... }
```

## Root cause

A **false positive** caused by an AWS API constraint Semgrep cannot model statically.

The `viewer_certificate` block looks like this:

```hcl
viewer_certificate {
  cloudfront_default_certificate = !local.use_custom_domain
  acm_certificate_arn            = local.use_custom_domain ? var.acm_certificate_arn : null
  ssl_support_method             = local.use_custom_domain ? "sni-only" : null
  minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : null
}
```

Two branches:

1. **Custom domain** (`local.use_custom_domain = true`) — `minimum_protocol_version = "TLSv1.2_2021"`. Modern TLS enforced.
2. **No custom domain** (default dev state) — `minimum_protocol_version = null`. AWS **requires** `null` (which it renders as `TLSv1`) when using the default `*.cloudfront.net` certificate. Attempting to set `TLSv1.2_2021` on the default certificate returns an AWS API error.

Semgrep's pattern match sees `minimum_protocol_version = ... : null` and assumes the worst-case branch is live, regardless of the `local.use_custom_domain` gating.

## Fix

Inline `# nosemgrep` annotation with a written explanation on the exact resource the rule matches against.

```hcl
# With a custom ACM cert the viewer_certificate block below pins
# minimum_protocol_version to TLSv1.2_2021. Without one (local/dev), AWS
# only accepts `TLSv1` alongside the default *.cloudfront.net cert, so the
# null branch is an AWS API constraint rather than a policy choice. Semgrep
# cannot distinguish the two conditional branches at analysis time, so
# suppress the rule on the resource it matches against.
# nosemgrep: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
resource "aws_cloudfront_distribution" "site" {
  ...
}
```

Originally opened as [PR #19](https://github.com/asadyare/secure-banking-app/pull/19), then **cherry-picked into PR [#18](https://github.com/asadyare/secure-banking-app/pull/18)** so the Trivy+Semgrep fixes went in atomically; #19 was closed as a duplicate. See [terraform/modules/aws_static_site/main.tf](../../../terraform/modules/aws_static_site/main.tf).

## Proof

Semgrep green on PR #18 and every subsequent run. The rule still applies to any *new* CloudFront distribution added to the repo; the suppression is scoped to a single resource.

## Screenshot slot

None required — log + diff evidence is sufficient. Optional `shot-list.md` entry **S-13** for the AWS CloudFront Console → distribution → Origins/Behaviours tab showing the effective `Minimum protocol version: TLSv1.2_2021` on the production distribution.

## Lessons

- Inline SAST suppressions are fine when the *rule* is right but the *scope* is wrong. The key is an explicit justification in the same commit, not a bare `# nosemgrep`.
- Scoping a suppression to a single resource (via the rule-id in the annotation) means future additions of the same resource type are still scanned — the blanket-ignore anti-pattern does not apply.
- When two fixes depend on each other, cherry-picking them into one PR is cleaner than two PRs that each look red until both are merged.

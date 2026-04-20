# Incident 12 — Trivy IaC: `AVD-AWS-0011` (CloudFront WAF) and `AVD-AWS-0132` (S3 CMK)

## Symptom

Trivy IaC scan flagged two findings on the static-site Terraform module:

```
AVD-AWS-0011 (HIGH)  CloudFront distribution does not have an attached WAF
  → terraform/modules/aws_static_site/main.tf  aws_cloudfront_distribution.site

AVD-AWS-0132 (HIGH)  S3 bucket should use a customer-managed KMS key
  → terraform/modules/aws_static_site/main.tf  aws_s3_bucket.site
```

## Root cause

Both are **false positives on this architecture**, but the scanner cannot know that without help:

### `AVD-AWS-0011` (CloudFront + WAF)

The module **does** attach a WAFv2 WebACL — conditionally on `var.waf_enabled`. Trivy's matcher does not follow the conditional expression on the `web_acl_id` attribute; it sees the `null` branch and flags the whole resource.

### `AVD-AWS-0132` (S3 + KMS CMK)

The module uses SSE-S3 by default (`aws_s3_bucket_server_side_encryption_configuration` with `AES256`). A customer-managed KMS key (CMK) is available via `var.kms_key_arn` when the operator provides one. For a **public static website where every object is served through CloudFront to unauthenticated users**, SSE-S3 is the correct default: the threat model does not include "S3 operator reads the bucket" and CMK adds operational cost + a KMS dependency without matching risk reduction.

## Fix

Suppress both findings with rationale in [.trivyignore](../../../.trivyignore), and document the opt-in paths (`var.waf_enabled`, `var.kms_key_arn`) in the Terraform module README so the operator sees how to turn each feature on.

```text
# .trivyignore
#
# AVD-AWS-0011  CloudFront distribution without WAF.
#   Module conditionally attaches aws_wafv2_web_acl when var.waf_enabled = true
#   (see terraform/modules/aws_static_site/main.tf). Trivy cannot trace the
#   conditional.
AVD-AWS-0011
#
# AVD-AWS-0132  S3 bucket without CMK.
#   Public SPA origin served through CloudFront OAC - no confidentiality gain
#   from CMK in this threat model. Opt in via var.kms_key_arn if stronger
#   key separation is required.
AVD-AWS-0132
```

Part of PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) — merged as [`a9e4ffc`](https://github.com/asadyare/secure-banking-app/commit/a9e4ffc).

## Proof

- Trivy IaC green on PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) and every subsequent run.
- The Terraform module's WAF + KMS variables are still wired and documented: `terraform apply` with `waf_enabled = true` and `kms_key_arn = "arn:..."` enables both controls without code changes.

## Screenshot slot

`shot-list.md` entry **S-12** — AWS Console → WAF & Shield → Web ACLs, showing the WebACL associated with the CloudFront distribution (proving the "no WAF" finding is a scanner limitation, not a missing control).

## Lessons

- Ignore files are part of the threat-model narrative. Without a rationale next to the suppression you lose the *why*, and a future engineer cannot tell a justified ignore from a lazy one.
- Security defaults should match the **threat model of the workload**. A CMK on a bucket whose objects are globally-readable via CloudFront is cargo-culting; the money and complexity are better spent elsewhere (WAF, rate limiting, anomaly detection).

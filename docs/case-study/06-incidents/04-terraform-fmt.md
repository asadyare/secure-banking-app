# Incident 04 — `terraform fmt -check` blocked CI on a trailing-whitespace regression

## Symptom

```
Run terraform fmt -check -recursive
versions.tf
Error: Process completed with exit code 3.
```

Exit code 3 from `terraform fmt -check` means "files need formatting" — non-fatal in day-to-day use but a hard gate in CI.

## Root cause

[`terraform/versions.tf`](../../../terraform/versions.tf) had trailing whitespace inside the `required_providers` block. The file was syntactically valid Terraform but cosmetically drifted from the canonical formatting.

## Fix

Run `terraform fmt -recursive` locally and commit the result. No functional change.

```terraform
# terraform/versions.tf (before)
terraform {
  required_providers {
    aws = {·····
      source  = "hashicorp/aws"
      version = "~> 5.70"·····
    }
  }
}

# after
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}
```

Commit: [`69eb0c6`](https://github.com/asadyare/secure-banking-app/commit/69eb0c6) — *style(terraform): apply terraform fmt to versions.tf*.

## Proof

Next CI run shows `Terraform fmt & validate — pass`. Confirmed on PR [#21](https://github.com/asadyare/secure-banking-app/pull/21) and every subsequent run.

## Screenshot slot

None — log-only evidence.

## Lessons

- `terraform fmt -check` is cheap, deterministic, and catches a whole class of review noise. Running it as a credential-free job before OIDC configuration is the right order: broken HCL fails fast and cheaply.
- Consider a `pre-commit` hook mirror (`terraform fmt -recursive`) so the CI gate never trips on formatting alone.

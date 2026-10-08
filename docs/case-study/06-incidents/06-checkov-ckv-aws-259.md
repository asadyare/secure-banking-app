# Incident 06 — Checkov `CKV_AWS_259` demanded HSTS preload

## Symptom

```
Check: CKV_AWS_259: "Ensure CloudFront response header policy enforces Strict Transport Security"
  FAILED for resource: module.static_site.aws_cloudfront_response_headers_policy.security_headers
```

`CKV_AWS_259` passes only when `strict_transport_security { preload = true, include_subdomains = true }` is set.

## Root cause

Not a bug — a **policy disagreement**. `preload = true` submits the apex domain (and all subdomains) to the browser-shipped HSTS preload list. It is:

- **Irreversible in practice** — once shipped in Chrome/Firefox/Safari you cannot untrust it for the lifetime of those browsers in the wild.
- **All-subdomains** — every subdomain, current and future, must be HTTPS-only forever.
- **Per-domain** — you have to register at [hstspreload.org](https://hstspreload.org) yourself.

These are properties that must be an **explicit operator choice**, not a silently-inherited default from an IaC scanner.

## Fix

Skip the check with a documented rationale in [checkov.yaml](../../../checkov.yaml), and make the HSTS preload flags **operator-toggleable** via Terraform variables (already present in [terraform/terraform.tfvars](../../../terraform/terraform.tfvars)).

```yaml
# checkov.yaml
skip-check:
  ...
  - CKV_AWS_259  # HSTS preload is an irreversible, per-domain commitment
                 # that requires registration at hstspreload.org; operators opt
                 # in via hsts_preload / hsts_include_subdomains in
                 # terraform.tfvars
  ...
```

The Terraform module continues to emit HSTS by default (`max-age=63072000; includeSubDomains`) — just without `preload` unless `hsts_preload = true` is set in `terraform.tfvars`.

Commit: [`f5099a2`](https://github.com/asadyare/secure-banking-app/commit/f5099a2) — *ci(checkov): skip CKV_AWS_259 with HSTS preload rationale*.

## Proof

Checkov green on PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) and onward. The `skip-check` comment serves as audit trail so a future reviewer sees *why*, not just *what*.

## Screenshot slot

None — log-only evidence. Optional `shot-list.md` entry **S-04** if you want a GitHub Security tab shot showing no open Checkov findings.

## Lessons

- Not every scanner finding is a vulnerability — some are *policy opinions*. Treat them that way: skip with rationale, expose the underlying control as a configurable variable, make the default safe-but-reversible.
- HSTS preload specifically is a recurring DevSecOps trap. Blindly enabling it on the back of a green-CI check has nuked small businesses that later needed to downgrade a dev subdomain to plain HTTP.

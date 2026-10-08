# 03 — Security controls

One section per scanner / control. Every section answers the same four questions:

1. **What** does it check?
2. **Where** is it wired?
3. **Why** is it there (what does it catch that the others do not)?
4. **How** do we treat its findings (gate vs warn, where are suppressions justified)?

---

## SAST

### Semgrep

- **What**: pattern-based static analysis across the full repo. Runs the `p/ci`, `p/default`, `p/security-audit`, `p/secrets`, `p/owasp-top-ten`, and `p/terraform` rule packs.
- **Where**: the `Semgrep` job in [.github/workflows/ci.yml](../../.github/workflows/ci.yml).
- **Why**: catches code smells + security patterns that are too fuzzy for CodeQL's semantic model (e.g. insecure defaults in Terraform blocks, logging of sensitive values, regex DoS patterns). Cheap to run on every push.
- **Findings policy**: must be green on `main`. The only suppression is an inline `# nosemgrep` on the CloudFront TLS rule, with an explicit rationale that AWS itself restricts the default certificate to TLSv1 (see [incident 13](06-incidents/13-semgrep-cloudfront-tls.md) and [terraform/modules/aws_static_site/main.tf](../../terraform/modules/aws_static_site/main.tf)).

### CodeQL (default setup)

- **What**: GitHub's managed semantic code scanning for JavaScript/TypeScript, Python, and GitHub Actions.
- **Where**: repo-level **Code scanning default setup** (Settings → Code security). There is *no* custom workflow file; the former `codeql.yml` was removed in [PR #20](https://github.com/asadyare/secure-banking-app/pull/20) because default setup and custom advanced workflows conflict (see [incident 14](06-incidents/14-codeql-default-vs-custom.md)).
- **Why**: CodeQL sees data flow across function boundaries in a way Semgrep cannot. It also satisfies the `main` branch ruleset requirement for a CodeQL result.
- **Findings policy**: Security tab blocker — any High/Critical result blocks merges via the ruleset.

---

## Dependencies & vulnerability scanning

### Trivy (filesystem + IaC)

- **What**: scans dependencies, Dockerfile, and Terraform for CVEs and misconfigurations. Emits SARIF, uploaded to the Security tab and archived as a workflow artifact.
- **Where**: two jobs in [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — `Trivy (filesystem)` and `Trivy`. Action pinned by full commit SHA (`aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1 # v0.35.0`) after the upstream `0.28.0` tag was yanked post supply-chain incident (see [incident 07](06-incidents/07-trivy-action-tag.md)).
- **Why**: lockfile + image + IaC scanning in one tool, and it renders nicely in the Security tab when SARIF upload is available.
- **Findings policy**: job hard-fails on findings. Justified ignores live in [.trivyignore](../../.trivyignore):
  - `AVD-AWS-0011` — CloudFront without WAF: false positive, we *do* attach a WAFv2 WebACL conditionally.
  - `AVD-AWS-0132` — S3 without a customer-managed KMS key: SSE-S3 is the correct default for a public-SPA use case; CMK is documented as opt-in.
  - Rationale on both entries is in the file itself and repeated in [incident 12](06-incidents/12-trivy-iac-waf-kms.md).

### Dependency Review

- **What**: GitHub's PR-time dependency diff — flags newly introduced vulnerable versions and licence issues.
- **Where**: `Dependency Review` job in CI, PR-only (requires the GitHub dependency graph, which is on by default for public repos).
- **Why**: stops a regression *before* merge, even if Trivy or npm audit would also catch it post-merge.

### `npm audit` + SBOM

- **What**: `npm audit --audit-level=high` in CI blocks on high/critical advisories. CycloneDX SBOM generated on every CI run via `@cyclonedx/cdxgen` and uploaded as a workflow artifact (full tree + `--required-only` production view).
- **Where**: `Lint, test, build, npm audit` job in CI.
- **Why**: redundant with Trivy deliberately — `npm audit` uses the npm advisory DB which sometimes fires before Trivy's DB is updated. SBOM gives us a snapshot artefact for supply-chain provenance and downstream VEX workflows.

### Dependabot

- **What**: weekly dependency PRs for npm, GitHub Actions, Docker, and Terraform providers.
- **Where**: [.github/dependabot.yml](../../.github/dependabot.yml).
- **Why**: keeps pinned SHAs current without manual triage. Dependabot PRs flow through the same branch ruleset as a human PR — they cannot skip any scanner.

---

## Secret scanning

### Gitleaks (local + CI)

- **What**: secret scanning with a custom allowlist. Runs in three places:
  1. Husky **pre-commit** (`gitleaks protect --staged`) — blocks a secret from ever reaching history.
  2. Husky **pre-push** (`gitleaks detect`) — last-chance scan against the working tree.
  3. CI `Gitleaks` job — authoritative check on every push/PR.
- **Where**: [.husky/pre-commit](../../.husky/pre-commit), [.husky/pre-push](../../.husky/pre-push), `Gitleaks` job in CI.
- **Why**: defense in depth. The hooks are fast and catch mistakes before CI time; the CI job is the trust anchor because hooks can be skipped with `--no-verify`.

### TruffleHog (only-verified)

- **What**: `trufflesecurity/trufflehog` running with `--only-verified`, so it asserts the *finding is a live credential*, not just a pattern match.
- **Where**: [.github/workflows/secret-scan.yml](../../.github/workflows/secret-scan.yml). Action pinned to commit SHA `47e7b7cd74f578e1e3145d48f669f22fd1330ca6` (v3.94.3) after the floating `v3` tag stopped resolving (see [incident 16](06-incidents/16-trufflehog-action-tag.md)).
- **Why**: Gitleaks is regex-driven and noisy; TruffleHog's verifier mode is low-false-positive. Runs as a separate workflow so a verifier hang cannot stall the main CI pipeline.

---

## IaC security

### Checkov

- **What**: IaC security and compliance scanner over the `terraform/` tree. Config at [checkov.yaml](../../checkov.yaml): `soft-fail: false`, explicit framework allow-list, `skip-check:` entries that each carry a written rationale.
- **Where**: `Checkov (Terraform)` job in CI.
- **Why**: complements Trivy IaC — Checkov's ruleset is richer on AWS-managed-service specifics (WAF logging configuration, CloudFront defaults, KMS rotation). Its finding taxonomy (`CKV_AWS_*`) maps directly to the [bridgecrewio docs](https://docs.prismacloud.io/en/enterprise-edition/policy-reference/aws-policies).
- **Findings policy**: hard-fail on everything except the documented `skip-check` list. Most notable: `CKV_AWS_259` (HSTS preload) is skipped because `preload = true` is an irreversible per-domain commitment that must be an explicit operator decision (see [incident 06](06-incidents/06-checkov-ckv-aws-259.md)).

### Terraform fmt + validate

- **What**: `terraform fmt -check -recursive` and `terraform validate`.
- **Where**: `Terraform fmt & validate` job in CI. These run *before* any credential configuration so broken HCL fails fast without needing OIDC.
- **Why**: fmt/validate are credential-free checks; running them in the PR gate means Terraform problems surface on the PR, not on the post-merge apply job.

---

## DAST

### OWASP ZAP baseline

- **What**: passive baseline scan against a locally-served production build (`npx serve dist/` on port 4173), with rules in [.zap/rules.tsv](../../.zap/rules.tsv).
- **Where**: `OWASP ZAP (baseline DAST)` job in CI.
- **Why**: verifies the **actually-served** response headers + CSP, not just the static source. It caught several header regressions during hardening — see incidents [01](06-incidents/01-zap-docker-networking.md), [02](06-incidents/02-zap-serve-schema.md), and [03](06-incidents/03-zap-security-headers.md).
- **Findings policy**: hard-fail on any `WARN-NEW` / `FAIL-NEW`. Explicit `IGNORE` rules in `.zap/rules.tsv` cover findings that either cannot be fixed without breaking functionality (e.g. `style-src 'unsafe-inline'` required by Radix/shadcn) or represent deliberate trade-offs (`Cache-Control: no-store` for a banking SPA). Each has a one-line rationale in the TSV.

---

## Edge hardening (runtime, not scanner)

Not a scanner per se, but part of the same security surface:

- **CloudFront response-headers policy** emits HSTS (`max-age=63072000; includeSubDomains`), CSP, COOP/CORP/COEP, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a Permissions-Policy with almost every feature disabled. These headers are enforced at the CDN, so they survive an SPA regression.
- **WAFv2 WebACL** with AWS managed rule groups is attached via the Terraform module when `waf_enabled = true`.
- **S3 bucket** has public access blocks on, versioning on, SSE-S3 (or CMK when supplied), and is only reachable via CloudFront OAC.
- **Dockerfile** uses `nginxinc/nginx-unprivileged` and `USER nginx` so even the container path is non-root-by-default (see [incident 11](06-incidents/11-trivy-dockerfile-nonroot.md)).

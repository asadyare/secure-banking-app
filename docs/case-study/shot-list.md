# Screenshot shot-list

The case study is complete as a **text narrative + log/diff evidence**. These screenshots are the visual layer that makes it portfolio-ready. Each entry below tells you exactly where to go, what to capture, what filename to save as (drop into `assets/`), and a caption to use in-doc.

Once a screenshot is captured, replace the corresponding `TODO-<id>.png` placeholder in `assets/` with the real PNG and keep the filename identical so the embeds below resolve without further edits.

## Conventions

- **Dimensions**: aim for 1600×1000 viewport or larger. Portfolio reviewers are on laptops, not phones.
- **Privacy**: crop out anything account-specific you do not want public (AWS account number is already `733366528696` and is in documents in this repo — fine to leave; redact anything that is not in-tree).
- **Dark mode**: GitHub renders both well; live site is your call — pick whichever has better contrast for the header panel you capture.

## Group A — Live site (the payoff shots)

### S-01 — Home page hero on CloudFront

- **Where**: the CloudFront URL (`terraform output cloudfront_url`, typically `https://d<hash>.cloudfront.net/`).
- **Capture**: full browser window on the home / landing page, address bar visible with the `d…cloudfront.net` hostname and lock icon.
- **Filename**: `assets/S-01-live-home.png`.
- **Caption**: *"Live production build served from Amazon CloudFront; S3 origin is private behind Origin Access Control."*

### S-02 — Security headers in DevTools

- **Where**: same CloudFront URL, open DevTools → Network → reload → click the `/` document request → Headers tab.
- **Capture**: the Response Headers panel, scrolled so `Strict-Transport-Security`, `Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Embedder-Policy`, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options` are all visible.
- **Filename**: `assets/S-02-security-headers-devtools.png`.
- **Caption**: *"CloudFront response-headers policy enforces the full hardening set on every response, independent of the SPA build."*

### S-03 — Observatory / SSL Labs grade (optional but high-impact)

- **Where**: [https://observatory.mozilla.org/](https://observatory.mozilla.org/) or [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/), scan the CloudFront URL.
- **Capture**: the grade + header checklist.
- **Filename**: `assets/S-03-observatory-grade.png`.
- **Caption**: *"Mozilla Observatory grade for the deployed site — passes all standard header checks."*

## Group B — GitHub (the proof-of-work shots)

### S-04 — Security tab → Code scanning alerts (zero findings)

- **Where**: `https://github.com/asadyare/secure-banking-app/security/code-scanning`.
- **Capture**: the alerts list filtered by tool (Trivy, CodeQL). Capture the "No open alerts" / "Dismissed" view.
- **Filename**: `assets/S-04-security-code-scanning.png`.
- **Caption**: *"Zero open Code Scanning alerts across CodeQL (default setup) and Trivy SARIF."*

### S-05 — Code scanning default setup status

- **Where**: Settings → Code security → Code scanning.
- **Capture**: the "Default setup" panel showing **Enabled** with languages (JavaScript/TypeScript, Python, Actions) and query suite.
- **Filename**: `assets/S-05-default-setup-enabled.png`.
- **Caption**: *"CodeQL default setup is the canonical source of truth; no custom `codeql.yml` (see incident 14)."*

### S-06 — IAM role trust policy

- **Where**: AWS Console → IAM → Roles → `AWS_ROLE_ARN` → Trust relationships tab.
- **Capture**: the JSON editor with the trust policy showing the `sub` and `aud` conditions.
- **Filename**: `assets/S-06-trust-policy.png`.
- **Caption**: *"Trust policy pinned to `repo:asadyare/secure-banking-app:ref:refs/heads/main` with `aud=sts.amazonaws.com`."*

### S-07 — All CI checks green

- **Where**: a recent PR status checks drawer, e.g. [PR #25](https://github.com/asadyare/secure-banking-app/pull/25).
- **Capture**: the full checks list — all 14+ checks with green ticks.
- **Filename**: `assets/S-07-all-checks-green.png`.
- **Caption**: *"Every scanner green on a recent PR; the `main` branch ruleset requires all of these before merge."*

### S-08 — ZAP HTML report

- **Where**: Actions → pick a recent `CI (Continuous Integration Pipeline)` run → Artifacts → `zap_scan.zip` → open the HTML report.
- **Capture**: the summary header (PASS/WARN/IGNORE counts) and the alerts table.
- **Filename**: `assets/S-08-zap-report.png`.
- **Caption**: *"ZAP baseline summary: 62 PASS, 5 IGNORE (each with rationale in `.zap/rules.tsv`), 0 WARN, 0 FAIL."*

### S-09 — Trivy SARIF artifact in a workflow run

- **Where**: Actions → pick a recent CI run with the Trivy job → bottom of page → Artifacts drawer.
- **Capture**: the `trivy-results` artifact listed.
- **Filename**: `assets/S-09-trivy-artifact.png`.
- **Caption**: *"Trivy SARIF archived as a workflow artifact on every run (see incident 09 for rationale)."*

### S-10 — Trivy findings before vs after `bun.lock` deletion

- **Where**: two runs — the last red CI run before PR #18, and the first green CI run after merge. Download the `trivy-results` artifact from each and open in a SARIF viewer.
- **Capture**: two side-by-side screenshots of the findings count.
- **Filename**: `assets/S-10a-trivy-before.png` and `assets/S-10b-trivy-after.png`.
- **Caption**: *"Before: phantom CVEs on `@remix-run/router` / `lodash` from stale `bun.lock`. After: 0 findings."*

### S-11 — Non-root container

- **Where**: local laptop: `docker build . -t baawisan-bank-local && docker run -d --rm -p 8080:8080 --name bb baawisan-bank-local && docker inspect bb | jq '.[0].Config.User'`.
- **Capture**: terminal showing `"nginx"` printed by `jq`.
- **Filename**: `assets/S-11-docker-nonroot.png`.
- **Caption**: *"Runtime container runs as the `nginx` user (see incident 11)."*

### S-12 — WAFv2 WebACL association

- **Where**: AWS Console → WAF & Shield → Web ACLs → `CLOUDFRONT` scope → the WebACL used by the distribution → Associated AWS resources tab.
- **Capture**: the distribution listed as an associated resource.
- **Filename**: `assets/S-12-waf-association.png`.
- **Caption**: *"WAFv2 WebACL attached to the CloudFront distribution, refuting Trivy `AVD-AWS-0011`."*

### S-13 — CloudFront minimum TLS version

- **Where**: AWS Console → CloudFront → Distributions → the site distribution → General tab.
- **Capture**: the "Minimum TLS version" line (`TLSv1.2_2021` for custom-domain setups, `TLSv1` for default certificate).
- **Filename**: `assets/S-13-cloudfront-tls.png`.
- **Caption**: *"Effective minimum TLS version set by CloudFront; Semgrep false positive documented in incident 13."*

### S-14 — "Terraform skipped" summary

- **Where**: Actions → Terraform workflow run triggered without backend secrets set (dispatch on a branch where the secrets are empty to reproduce).
- **Capture**: the job summary panel showing the "Terraform skipped" markdown block.
- **Filename**: `assets/S-14-terraform-skipped-summary.png`.
- **Caption**: *"Preflight skips Terraform init with actionable guidance instead of crashing (incident 17)."*

### S-15 — "Frontend deploy skipped" summary

- **Where**: Actions → Deploy frontend run triggered before the IAM policy was fixed (incident 19) — or any run where `S3_BUCKET_ID` is unset.
- **Capture**: the job summary panel showing the "Frontend deploy skipped" markdown.
- **Filename**: `assets/S-15-deploy-skipped-summary.png`.
- **Caption**: *"Two-stage deploy preflight skips S3 sync + CloudFront invalidation with a readable summary (incident 18)."*

### S-16 — IAM role permissions tab

- **Where**: AWS Console → IAM → Roles → `AWS_ROLE_ARN` → Permissions tab → click the inline `deploy-frontend` policy.
- **Capture**: the policy document showing real bucket + distribution ARNs (not `<placeholder>` values — that is the point of incident 19).
- **Filename**: `assets/S-16-iam-inline-policy.png`.
- **Caption**: *"Least-privilege inline policy: exact bucket + distribution ARNs, no wildcards."*

### S-17 — First successful deploy run

- **Where**: [`actions/runs/24605611658`](https://github.com/asadyare/secure-banking-app/actions/runs/24605611658).
- **Capture**: the full job step list — every step SUCCESS, including `Verify deploy targets exist`, `Sync to S3`, `Invalidate CloudFront`.
- **Filename**: `assets/S-17-first-green-deploy.png`.
- **Caption**: *"First successful end-to-end deploy after closing incident 19."*

## Group C — "Nice to have" (optional, time permitting)

### S-18 — Branch ruleset view

- **Where**: Settings → Rules → Rulesets → `main` ruleset.
- **Capture**: the required status checks list, showing all scanners.
- **Filename**: `assets/S-18-ruleset-required-checks.png`.
- **Caption**: *"Branch ruleset requires every scanner to be green before a PR can merge into `main`."*

### S-19 — Dependabot PR list

- **Where**: PRs list filtered to `author:app/dependabot`.
- **Capture**: the list of open Dependabot PRs subject to the same ruleset.
- **Filename**: `assets/S-19-dependabot-prs.png`.
- **Caption**: *"Dependabot updates flow through the same scanner gate as human PRs."*

## Placeholder policy

Before any shot is captured, leave a 1×1 `TODO-S-XX.png` in `assets/` with the same filename pattern. This makes it obvious on a directory listing what is still outstanding.

## Done?

When every slot in Group A + B has a real PNG, update the **Case study** section of the top-level [`README.md`](../../README.md) with a hero image reference (`S-01-live-home.png` is the right choice) and you are ready to link the folder from your portfolio repo.

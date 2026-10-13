# Incident 15 — Terraform OIDC: `Not authorized to perform sts:AssumeRoleWithWebIdentity`

## Symptom

```
Error: Could not assume role with OIDC:
  Not authorized to perform sts:AssumeRoleWithWebIdentity
```

Happened on a `pull_request` run of the Terraform workflow.

## Root cause

The AWS IAM role's **trust policy** scoped the allowed GitHub subject to protected branch refs only:

```jsonc
// trust policy (excerpt)
"Condition": {
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:asadyare/secure-banking-app:ref:refs/heads/main"
  },
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  }
}
```

That is **the correct least-privilege scoping** — a PR from a feature branch gets an OIDC token with a `sub` of `repo:asadyare/secure-banking-app:pull_request` (or `ref:refs/pull/NN/merge`), neither of which matches the allowed `refs/heads/main` subject. So OIDC rejects the assume-role, and the Terraform plan step fails on the PR.

The blast radius was broader than necessary because the Terraform workflow was triggering on `pull_request` at all — but **Terraform `fmt` and `validate` do not need credentials**, and those are the only Terraform checks that make sense on a PR.

## Fix

Remove `pull_request` from the Terraform workflow's triggers. `fmt`/`validate` are already covered by a credential-free job in [ci.yml](../../../.github/workflows/ci.yml); the Terraform workflow is now **push-to-protected-branches + manual dispatch only**.

```diff
  on:
    push:
      branches: [main]
-   pull_request:
-     branches: [main]
    workflow_dispatch:
```

And remove the now-unused guard on the main job:

```diff
  jobs:
    terraform:
      runs-on: ubuntu-latest
-     if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false
      permissions:
        id-token: write
        contents: read
```

Part of PR [#20](https://github.com/asadyare/secure-banking-app/pull/20) — merged as [`a090b39`](https://github.com/asadyare/secure-banking-app/commit/a090b39). Detailed troubleshooting notes also added to [docs/github-oidc-aws.md](../../github-oidc-aws.md).

## Proof

- PR runs of the Terraform workflow no longer execute (no `AssumeRoleWithWebIdentity` attempts from PR contexts).
- Post-merge runs on `main` continue to assume the role successfully — see any recent run on the `Terraform` workflow page.

## Screenshot slot

`shot-list.md` entry **S-06** — AWS IAM Console → Roles → `AWS_ROLE_ARN` → Trust relationships tab, showing the `token.actions.githubusercontent.com:sub` condition pinned to `refs/heads/main`.

## Lessons

- **Narrow trust policies are right**, and workflows should respect them. If a job cannot work from a PR context, do not trigger it on `pull_request` — run a credential-free surrogate instead.
- The `sub` claim is the single most important OIDC field to scope. Pin it to `repo:<owner>/<repo>:ref:refs/heads/<branch>` or `repo:<owner>/<repo>:environment:<env>`, never leave it open to `repo:<owner>/<repo>:*`.
- Fork PRs have a different `sub` shape (`repo:...:pull_request`) and will never match a ref-based trust policy — that is a feature.

# Incident 14 — CodeQL: default setup collided with a custom workflow

## Symptom

```
Error: CodeQL analyses from advanced configurations cannot be processed when
       the default setup is enabled.
```

The run was triggered by a custom `.github/workflows/codeql.yml`. GitHub rejected the analysis results at upload time.

## Root cause

Repo-level **Code scanning default setup** was enabled in Settings → Code security. Default setup is a GitHub-managed CodeQL configuration that runs on its own schedule with a curated language + query set. Custom "advanced" CodeQL workflows submit results to the same Security-tab endpoint, and the two configurations **cannot coexist**: GitHub will only accept one source of CodeQL truth per repo.

The project originally shipped a custom `codeql.yml` (before default setup was flipped on). After the toggle, the custom workflow's analyses were being rejected every run, which cascaded to the branch ruleset because `CodeQL` was a required status.

## Fix

Delete the custom workflow. Default setup is sufficient for a TypeScript + Python + Actions project and satisfies the ruleset via the `Analyze (actions)`, `Analyze (javascript-typescript)`, and `Analyze (python)` checks it publishes.

```diff
- .github/workflows/codeql.yml      # deleted in PR #20
```

Part of PR [#20](https://github.com/asadyare/secure-banking-app/pull/20) — *ci: repair CodeQL, Terraform, and secret-scan workflows* — merged as [`a090b39`](https://github.com/asadyare/secure-banking-app/commit/a090b39).

## Proof

- Default setup's three `Analyze (...)` checks are now green on every PR (visible on PR [#25](https://github.com/asadyare/secure-banking-app/pull/25) status list).
- No `CodeQL analyses from advanced configurations...` errors in any subsequent run.

## Screenshot slot

`shot-list.md` entry **S-05** — Settings → Code security → Code scanning showing **Default setup: Enabled** with the language/query matrix.

## Lessons

- Know which CodeQL configuration you are using **before** you add a custom workflow. If default setup is on, a custom workflow is not additive — it is a conflict.
- When migrating from custom → default, delete the workflow and update any branch ruleset required-check names (default setup publishes check names with language suffixes: `Analyze (javascript-typescript)`, not plain `CodeQL`).

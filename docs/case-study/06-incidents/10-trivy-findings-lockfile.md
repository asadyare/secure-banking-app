# Incident 10 — Trivy reported phantom CVEs from a stale `bun.lock`

## Symptom

Trivy filesystem scan hard-failed on what looked like real dependency CVEs:

```
Run exit 1
Error: Process completed with exit code 1.
```

Drilling into the report: high-severity findings on `@remix-run/router` and `lodash` transitive versions — packages the runtime was **not** actually using.

## Root cause

The repo had **two lockfiles**: `package-lock.json` (npm, canonical) and `bun.lock` (an artefact from an early scaffolding experiment). Trivy scans *any* lockfile it recognises, so it was reporting CVEs against the Bun resolution of the tree — which diverged from the npm resolution and included older transitive versions that the actually-installed tree (from `package-lock.json`) had already overridden.

## Fix

Delete `bun.lock`. The project uses npm exclusively; there is no reason to keep the stale lockfile around.

```diff
- bun.lock          # deleted in PR #18
```

Part of PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) — *security: clear blocking Trivy and Semgrep findings across lockfile, Dockerfile, IaC* — merged as [`a9e4ffc`](https://github.com/asadyare/secure-banking-app/commit/a9e4ffc).

## Proof

Post-merge: Trivy filesystem scan drops the phantom CVEs and the job goes green. The remaining Trivy findings were real IaC misconfigurations addressed in [incidents 11](11-trivy-dockerfile-nonroot.md) and [12](12-trivy-iac-waf-kms.md), in the same PR.

## Screenshot slot

`shot-list.md` entry **S-10** — Trivy SARIF summary (from the workflow artifact) before vs after: before shows entries for `@remix-run/router` / `lodash`, after shows zero findings on those packages.

## Lessons

- **One package manager per repo.** Commit exactly one lockfile. Scanners that accept multiple are doing you a favour by being thorough, but they will surface vulnerabilities in code paths you do not ship.
- When retiring a package manager, grep the repo for *all* its artefacts — `bun.lock`, `.bun-version`, `bunfig.toml`, `.npmrc`-style config files — and delete them in the same commit. Otherwise Trivy/Dependabot will keep nagging about code nobody runs.

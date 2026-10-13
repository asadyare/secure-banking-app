# Incident 08 — Trivy SARIF upload: `Resource not accessible by integration`

## Symptom

```
Error: Resource not accessible by integration -
https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run
```

The Trivy step had completed and produced `trivy-results.sarif`. The failure was in the follow-up `github/codeql-action/upload-sarif` step.

## Root cause

`upload-sarif` needs to enrich the SARIF with workflow-run metadata (run id, ref, sha, trigger) before posting it to the Code Scanning API. That metadata is read via the Actions API, which requires the **`actions: read`** permission. The job was declaring only `contents: read` and `security-events: write`.

Secondary issue surfaced at the same time: the upload action was still referencing the `@v3` major, which was deprecated during this project.

## Fix

Two changes in the same commit:

```diff
  trivy:
    permissions:
      contents: read
      security-events: write
+     actions: read          # required by upload-sarif to read workflow-run metadata
    steps:
      - name: Upload SARIF to Security tab
-       uses: github/codeql-action/upload-sarif@v3
+       uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: trivy-results.sarif
```

Commit: [`6f03cce`](https://github.com/asadyare/secure-banking-app/commit/6f03cce) — *ci(trivy): grant actions:read and bump upload-sarif to v4*.

## Proof

The step transitions from `Error: Resource not accessible by integration` to a successful upload. Best seen on the next CI run after the merge — the `Trivy` job in PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) passes cleanly, and the SARIF reaches the Security tab (until the next incident — see [09-trivy-sarif-default-setup](09-trivy-sarif-default-setup.md)).

## Screenshot slot

`shot-list.md` entry **S-04** — GitHub Security tab → Code scanning alerts, filtered to Trivy as the analysis tool. Confirms the SARIF landed.

## Lessons

- Every GitHub Action has a minimum-permissions matrix in its README. Reading it once and declaring permissions at the **job level** (not the workflow level) is the least-privilege move.
- Track `@v3 → @v4` announcements for security actions actively — deprecation windows are typically short for CodeQL-family actions.

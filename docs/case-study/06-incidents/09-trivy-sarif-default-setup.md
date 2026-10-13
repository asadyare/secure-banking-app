# Incident 09 — `Code scanning is not enabled for this repository`

## Symptom

After fixing [incident 08](08-trivy-sarif-permissions.md), SARIF upload still failed — with a different error:

```
Error: Code scanning is not enabled for this repository.
Please verify that the necessary features are enabled.
```

## Root cause

Posting to the Code Scanning API requires Code Scanning to be **enabled at the repo level** (Settings → Code security → Code scanning). On a public repo with GHAS-equivalent features, this is a toggle, not an action-side failure. The Trivy SARIF upload step was treating an inactive feature as a fatal error, blocking the entire CI run on a capability mismatch.

## Fix

Make the Security-tab upload **best-effort** and always archive the SARIF as a workflow artifact so it is still retrievable — either from the Security tab when enabled, or from the artifact when not.

```diff
      - name: Upload SARIF to Security tab
+       continue-on-error: true
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: trivy-results.sarif

+     - name: Archive SARIF artifact
+       if: always()
+       uses: actions/upload-artifact@v4
+       with:
+         name: trivy-results
+         path: trivy-results.sarif
+         retention-days: 14
```

Commit: [`67b3f1d`](https://github.com/asadyare/secure-banking-app/commit/67b3f1d) — *ci(trivy): make Security tab SARIF upload best-effort, always archive artifact*.

## Proof

Trivy job now green across all runs regardless of Code Scanning toggle state — confirmed on PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) and later. SARIF is downloadable from the workflow-run Artifacts tab.

## Screenshot slot

`shot-list.md` entry **S-09** — GitHub Actions run page showing `trivy-results` in the Artifacts drawer.

## Lessons

- **Repository-level features** (Code Scanning, Dependabot alerts, Secret Scanning) are not universally on. Pipelines that *require* them to be enabled implicitly break on forks and less-configured repos.
- Pattern: treat Security-tab uploads as optional enrichment, not the canonical record. Archive the raw SARIF/JSON as an artifact; any downstream tool can fetch it deterministically.

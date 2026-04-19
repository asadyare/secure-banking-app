# Incident 07 — `aquasecurity/trivy-action@0.28.0` no longer resolves

## Symptom

```
Error: Unable to resolve action `aquasecurity/trivy-action@0.28.0`, unable to find version `0.28.0`
```

## Root cause

`aquasecurity/trivy-action`'s `0.28.0` tag was removed from the upstream repository after a **supply-chain incident**, and the project subsequently migrated to `v`-prefixed semver tags. Any workflow still referencing the yanked tag breaks immediately.

## Fix

Pin to a **full commit SHA** of the current stable release with a `# vX.Y.Z` comment next to it. This satisfies two goals at once:

- Resolves deterministically even if the tag is later moved or deleted.
- Makes the version readable to humans without requiring a lookup.

```diff
  - name: Trivy vulnerability scan
-   uses: aquasecurity/trivy-action@0.28.0
+   uses: aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1 # v0.35.0
    with:
      scan-type: config
      ...
```

Commit: [`2b89f70`](https://github.com/asadyare/secure-banking-app/commit/2b89f70) — *ci(trivy): pin aquasecurity/trivy-action to v0.35.0 by commit SHA*.

## Proof

Trivy resolves and runs on the next CI pass. Every subsequent run in [PR #18](https://github.com/asadyare/secure-banking-app/pull/18) and later shows the action step resolving cleanly.

## Screenshot slot

None — log-only evidence.

## Lessons

- **Never** use floating `@v1` or version tags for third-party actions. A compromised or yanked tag propagates to every caller instantly; a full-SHA pin does not.
- Keep the `# vX.Y.Z` comment next to the SHA so Dependabot and humans both know the semantic version. Dependabot will update the SHA for you on new releases.
- `renovate`/Dependabot configurations can be tuned to always rewrite to SHAs automatically — see `.github/dependabot.yml` in this repo.

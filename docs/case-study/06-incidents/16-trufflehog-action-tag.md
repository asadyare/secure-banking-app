# Incident 16 — `trufflesecurity/trufflehog@v3` did not resolve

## Symptom

```
Error: Unable to resolve action `trufflesecurity/trufflehog@v3`,
       unable to find version `v3`
```

## Root cause

Unlike most GitHub Actions, `trufflesecurity/trufflehog` **does not publish a floating `v3` major tag** — only full `v3.x.y` tags. Workflows referencing `@v3` pretend the convention applies when it does not, and break on any fresh runner that cannot find a matching ref.

Secondary context: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` was also needed on this workflow because the action's ship-date compiled-action targets Node 20, which was being deprecated by GitHub in parallel.

## Fix

Pin to a **full commit SHA** of the current stable release with a `# vX.Y.Z` comment. Also add the Node 24 transition flag at the workflow level.

```diff
  env:
+   FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

  ...

      - name: TruffleHog OSS
-       uses: trufflesecurity/trufflehog@v3
+       # trufflesecurity/trufflehog does not publish a floating major tag (`v3`).
+       # Pin to the full SHA of the current stable release for supply-chain
+       # hardening. Tag reference: v3.94.3.
+       uses: trufflesecurity/trufflehog@47e7b7cd74f578e1e3145d48f669f22fd1330ca6 # v3.94.3
        with:
          path: ./
          extra_args: --only-verified
```

Part of PR [#20](https://github.com/asadyare/secure-banking-app/pull/20) — merged as [`a090b39`](https://github.com/asadyare/secure-banking-app/commit/a090b39).

## Proof

- `secret-scan.yml` workflow passes on every run from PR [#20](https://github.com/asadyare/secure-banking-app/pull/20) onward — see the `TruffleHog` check on [PR #25](https://github.com/asadyare/secure-banking-app/pull/25).
- Dependabot picks up the SHA and will bump it on new TruffleHog releases.

## Screenshot slot

None required — log + diff evidence is sufficient.

## Lessons

- Verify the upstream action's tag policy before pinning by major. Some projects (TruffleHog, `hashicorp/setup-terraform`, others) don't follow the `@v3` convention.
- Pairing SHA pins with `# vX.Y.Z` comments lets Dependabot rewrite the SHA while humans still see the semantic version at a glance.

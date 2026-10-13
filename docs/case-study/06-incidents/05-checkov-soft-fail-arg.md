# Incident 05 — Checkov rejected a stray `--soft-fail false` argument

## Symptom

```
usage: checkov [-h] [-v] [--support] [-d DIRECTORY] [--add-check] ...
checkov: error: unrecognized arguments: false
Error: Process completed with exit code 2.
```

## Root cause

The CI command had `checkov ... --soft-fail false`. In Checkov's argparse definition, `--soft-fail` is a **boolean switch** — its presence enables soft-fail, its absence disables it. It takes no value. Passing `false` is interpreted as a positional arg, which argparse rejects, and the job exits 2.

The `soft-fail: false` semantics we actually wanted were already expressed correctly in [checkov.yaml](../../../checkov.yaml).

## Fix

Drop the extraneous CLI argument; rely on the config file.

```diff
  - name: Checkov (Terraform)
    run: |
-     checkov -d terraform --config-file checkov.yaml --soft-fail false
+     checkov -d terraform --config-file checkov.yaml
```

And a clarifying comment in [checkov.yaml](../../../checkov.yaml):

```yaml
# Set to true to exit 0 when checks fail (e.g. gradual adoption).
# Pinned to false so CI hard-fails.
soft-fail: false
```

Commit: [`67bdfcf`](https://github.com/asadyare/secure-banking-app/commit/67bdfcf) — *ci(checkov): drop invalid --soft-fail false argument*.

## Proof

Next CI run: `Checkov (Terraform) — pass` (or fail on actual findings, but no longer on argparse). Confirmed green on PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) onwards.

## Screenshot slot

None — log-only evidence.

## Lessons

- When a CLI *looks* like it takes a value but the docs call it a "flag", read the argparse definition or run `--help` twice. Booleans with no `--no-foo` companion are a common foot-gun.
- Prefer config files to CLI flags for anything shared across repos — it gives you one place to audit policy decisions.

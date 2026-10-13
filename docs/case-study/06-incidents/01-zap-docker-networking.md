# Incident 01 — ZAP baseline could not reach the preview server on Linux

## Symptom

OWASP ZAP baseline aborted during spider with a DNS failure:

```
host.docker.internal: Name or service not known
Error: The process '/usr/bin/docker' failed with exit code 3
```

## Root cause

The CI target was `http://host.docker.internal:4173`. `host.docker.internal` is a **Docker Desktop** convenience hostname (macOS/Windows) that is **not** resolved on Linux GitHub runners. The ZAP baseline action runs its container with `--network=host`, so it shares the runner's network namespace — which means the preview server reachable on `127.0.0.1` from the runner is also reachable on `127.0.0.1` from inside the ZAP container.

## Fix

Retarget the scan to `127.0.0.1`.

```yaml
# .github/workflows/ci.yml (ZAP job)
- name: OWASP ZAP baseline
  uses: zaproxy/action-baseline@vX
  with:
-   target: http://host.docker.internal:4173
+   target: http://127.0.0.1:4173
    rules_file_name: .zap/rules.tsv
```

Commit: [`6981103`](https://github.com/asadyare/secure-banking-app/commit/6981103) — *ci(zap): target 127.0.0.1 so baseline scan reaches host server on Linux*.

## Proof

Spider completes and the ZAP baseline runs against the real preview server in every subsequent run, e.g. the all-green run on PR [#25](https://github.com/asadyare/secure-banking-app/pull/25) shows `OWASP ZAP (baseline DAST) — pass (1m30s)`.

## Screenshot slot

`shot-list.md` entry **S-07** — GitHub Actions "all checks green" view showing the ZAP job passing.

## Lessons

- `host.docker.internal` is platform-specific. For Linux CI, either use `--add-host=host.docker.internal:host-gateway` explicitly or use `127.0.0.1` when the container runs with `--network=host`.
- The ZAP baseline action uses host networking, which is an implementation detail worth reading the action source for rather than assuming Docker-Desktop-style behaviour.

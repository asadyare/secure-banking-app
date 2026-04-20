# Incident 03 — ZAP flagged nine missing security headers on the preview server

## Symptom

After ZAP could reach the server and the server could actually start, the baseline scan produced a wall of `WARN-NEW`:

```
WARN-NEW: Missing Anti-clickjacking Header [10020] x 3
WARN-NEW: X-Content-Type-Options Header Missing [10021] x 5
WARN-NEW: Content Security Policy (CSP) Header Not Set [10038] x 3
WARN-NEW: Storable and Cacheable Content [10049] x 5
WARN-NEW: Permissions Policy Header Not Set [10063] x 4
WARN-NEW: Timestamp Disclosure - Unix [10096] x 2
WARN-NEW: Modern Web Application [10109] x 3
WARN-NEW: Dangerous JS Functions [10110] x 1
WARN-NEW: Cross-Origin-Embedder-Policy Header Missing or Invalid [90004] x 10
FAIL-NEW: 0  WARN-NEW: 9  ...
Error: Scan action failed as ZAP has identified alerts
```

## Root cause

`npx serve` serves files with minimal defaults — `Content-Type` only. ZAP is doing its job and flagging that the response has no hardening headers. In production these headers come from the **CloudFront response-headers policy**, but the ZAP scan runs against the local preview server, so we needed the same headers emitted there.

A secondary root cause: three of the findings (10096, 10109, 10110) are **informational / false-positive on a modern SPA** and cannot be "fixed" without removing functionality (JS bundles will always contain 10-digit integers that look like Unix timestamps; Radix / shadcn legitimately use `eval`-flavoured patterns internally).

## Fix

Two complementary changes:

### 3.1 Emit production headers on the preview server

Create `serve.json` at the repo root with the full hardening set, and copy it into `dist/` in CI before starting the server.

```jsonc
// serve.json (excerpt)
{
  "headers": [
    { "source": "**", "headers": [
      { "key": "X-Content-Type-Options",   "value": "nosniff" },
      { "key": "X-Frame-Options",          "value": "DENY" },
      { "key": "Referrer-Policy",          "value": "no-referrer" },
      { "key": "Strict-Transport-Security","value": "max-age=31536000; includeSubDomains; preload" },
      { "key": "Cross-Origin-Opener-Policy",    "value": "same-origin" },
      { "key": "Cross-Origin-Resource-Policy",  "value": "same-origin" },
      { "key": "Cross-Origin-Embedder-Policy",  "value": "require-corp" },
      { "key": "Permissions-Policy",       "value": "accelerometer=(), autoplay=(), camera=(), ..." },
      { "key": "Content-Security-Policy",  "value": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; ..." },
      { "key": "Cache-Control",            "value": "no-store" }
    ] }
  ]
}
```

```yaml
# .github/workflows/ci.yml (ZAP job)
- name: Copy serve config into dist
  run: cp serve.json dist/serve.json
- name: Start preview server
  run: npx --yes serve@14 -s dist -l 4173 &
```

Commit: [`aa17667`](https://github.com/asadyare/secure-banking-app/commit/aa17667) — *ci(zap): emit security headers on test server and suppress irreducible warnings*.

### 3.2 Ignore irreducible findings with written rationale

Add targeted `IGNORE` rows to [.zap/rules.tsv](../../../.zap/rules.tsv):

```tsv
10049  IGNORE  Non-Storable / Storable Content - Cache-Control: no-store is intentional for a banking SPA
10055  IGNORE  CSP style-src unsafe-inline - required by Radix UI, shadcn and Tailwind runtime inline styles
10096  IGNORE  Timestamp Disclosure (Unix) - false positive on 10-digit integers in minified JS bundles
10109  IGNORE  Modern Web Application - informational SPA detection, not a vulnerability
10110  IGNORE  Dangerous JS Functions - heuristic flags benign usage inside third-party libraries
```

Commit: [`591d77f`](https://github.com/asadyare/secure-banking-app/commit/591d77f) — *ci(zap): ignore cache-control and style-src findings with documented rationale*.

## Proof

ZAP baseline summary after the fix:

```
FAIL-NEW: 0   FAIL-INPROG: 0
WARN-NEW: 0   WARN-INPROG: 0
INFO: 0       IGNORE: 5        PASS: 62
```

Run permalink for a green ZAP job: [`deploy-frontend` run 24605611658](https://github.com/asadyare/secure-banking-app/actions/runs/24605611658) (ZAP runs on every `ci.yml` push — pick any recent PR, e.g. [PR #25](https://github.com/asadyare/secure-banking-app/pull/25), and click the ZAP check).

## Screenshot slot

- `shot-list.md` entry **S-08** — ZAP HTML report summary showing `PASS: 62 / IGNORE: 5 / WARN-NEW: 0`.
- `shot-list.md` entry **S-03** — DevTools Network panel on the live CloudFront URL showing the same headers (with `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, etc.).

## Lessons

- Treat the DAST scanner as an **integration test for your edge configuration**, not an optional nice-to-have. It catches CDN misconfigurations on the way in and regressions on the way out.
- Every suppression gets a one-line rationale in the rules file. Six months later, the rationale is the difference between "why is this ignored?" and a confident "because …".
- Header parity between preview server and CloudFront is worth the 20 lines of JSON in `serve.json`.

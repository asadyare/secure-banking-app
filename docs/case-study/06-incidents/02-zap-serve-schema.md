# Incident 02 — `serve` rejected `serve.json` because of a `$schema` hint

## Symptom

Preview server failed to start before the ZAP scan could begin:

```
Run npx --yes serve@14 -s dist -l 4173 &
ERROR The configuration you provided is invalid: must NOT have additional properties {"additionalProperty":"$schema"}
Server failed to start
Error: Process completed with exit code 1.
```

## Root cause

`serve-handler` (used by `serve@14`) validates `serve.json` against a **strict JSON schema** with `additionalProperties: false` at the root level. The editor-friendly `"$schema": "..."` key I had added for IDE autocompletion is not in the allowed property set, so the whole file was rejected and the process exited 1.

## Fix

Drop the `$schema` key. The file is fully documented in [03-security-controls.md](../03-security-controls.md) anyway.

```diff
  {
-   "$schema": "https://raw.githubusercontent.com/vercel/serve-handler/.../schema.json",
    "headers": [
      { "source": "**", "headers": [
        { "key": "X-Content-Type-Options",   "value": "nosniff" },
        { "key": "X-Frame-Options",          "value": "DENY" },
        ...
      ] }
    ]
  }
```

Commit: [`53c75e6`](https://github.com/asadyare/secure-banking-app/commit/53c75e6) — *ci(zap): drop $schema from serve.json to satisfy serve-handler validator*.

## Proof

Next run: `npx serve@14 -s dist -l 4173` starts cleanly and ZAP proceeds to the header-enforcement stage (which surfaces the next class of findings, covered in [incident 03](03-zap-security-headers.md)).

## Screenshot slot

None required — log-only evidence.

## Lessons

- Tools that validate their own config with a strict JSON schema will reject `$schema` unless they opt into it. Either drop the hint or wrap the schema inline as a `JSONSchemaForVercelServeHandlerConfiguration` comment block for IDE support.
- Prefer a TypeScript helper or `.d.ts` adjunct for editor tooling over magical `$schema` keys when the consumer is a third-party validator you do not control.

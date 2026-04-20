# Incident 11 — Trivy `AVD-DS-0002`: container running as root

## Symptom

Trivy `fs` scan (IaC mode) flagged the runtime stage of the Dockerfile:

```
AVD-DS-0002: Image user should not be 'root' (HIGH)
  runtime stage inherits the default USER from nginx:1.27-alpine (= root)
```

## Root cause

The Dockerfile's final stage was:

```dockerfile
FROM nginx:1.27-alpine AS runtime
```

Upstream `nginx:1.27-alpine` runs nginx as **root** (even though the worker processes drop to `nginx`). That means every `COPY` in the final stage is owned by root, and any process exec'd into the container is root by default — a substantial blast-radius multiplier if a container escape or supply-chain issue hits the runtime.

## Fix

Swap the base to `nginxinc/nginx-unprivileged` (the official non-root-by-design variant) and add an explicit `USER nginx`. Port exposure moves from 80 → 8080 (the unprivileged variant's default), but that is private inside the Docker network anyway.

```diff
- FROM nginx:1.27-alpine AS runtime
+ FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
  COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
  COPY --from=build /app/dist /usr/share/nginx/html

+ USER nginx
+
- EXPOSE 80
+ EXPOSE 8080
  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
-   CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
+   CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
```

Part of PR [#18](https://github.com/asadyare/secure-banking-app/pull/18) — merged as [`a9e4ffc`](https://github.com/asadyare/secure-banking-app/commit/a9e4ffc).

## Proof

- Trivy scan clean for `AVD-DS-0002` on the next push.
- Container healthcheck still green; verified locally with `docker build . && docker run -p 8080:8080 image-under-test` and `curl -I localhost:8080`.

## Screenshot slot

`shot-list.md` entry **S-11** — Docker Desktop / `docker inspect` output showing `"User": "nginx"` on the running container.

## Lessons

- Non-root containers are table-stakes in 2026. Use `nginxinc/nginx-unprivileged` instead of `nginx` unless you have a specific reason not to (there almost never is one, outside ingress-controller setups).
- When you move to a non-root base, the exposed port typically changes (80 → 8080 for nginx-unprivileged). Update `EXPOSE`, the healthcheck, any `docker-compose.yml`, and downstream reverse-proxy configs in the same commit.

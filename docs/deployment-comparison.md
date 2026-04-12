# Deployment options: static (S3 + CloudFront) vs. Docker

This project is a **Vite + React single-page application (SPA)**. The “backend” for data and auth is **Supabase** (hosted API + Postgres). The frontend is **static files** after `npm run build` (HTML, JS, CSS, assets).

Two ways to run that frontend in production are compared below: the **static AWS stack** already defined in Terraform, and **container (Docker)** deployment.

---

## Method 1: Static hosting — S3 + CloudFront (current Terraform design)

**What it is:** Build the SPA in CI (or locally), upload `dist/` to a **private S3 bucket**, serve it globally via **CloudFront** with HTTPS, optional custom domain and ACM certificate, optional WAF.

**How this repo supports it:** `terraform/` (module `aws_static_site`), GitHub Actions workflow `deploy-frontend.yml` (build → `aws s3 sync` → CloudFront invalidation, OIDC to AWS).

| Aspect | Notes |
|--------|--------|
| **Fit for this app** | Excellent. SPAs are static assets; routing is client-side; Supabase is called from the browser. |
| **Cost (typical)** | Usually **low** for moderate traffic: S3 storage + CloudFront data transfer; no always-on servers. |
| **Operations** | **Low**: no VMs or container orchestration to patch. You manage Terraform, DNS, and pipeline secrets. |
| **Scaling** | **Automatic** at the CDN edge; no capacity planning for “web server” instances. |
| **Security surface** | **Small**: no application server in your account for the static site; bucket is not public; OAC limits access to CloudFront. |
| **Deploy model** | Immutable **files per release** (sync + invalidation). Rollback = redeploy previous `dist` or previous S3 version if versioning enabled. |
| **Build-time config** | `VITE_*` variables are baked in at **CI build time** (same as today in `deploy-frontend.yml`). |
| **Complexity** | You already invested in Terraform + OIDC + workflow; **first production path is mostly “wire secrets and domain.”** |

---

## Method 2: Docker (nginx + static `dist`)

**What it is:** Build the same SPA inside an image; **nginx** serves `dist/` (as in this repo’s `Dockerfile`). Run the container on **ECS/Fargate, Kubernetes, Azure Container Apps, App Service, a VM**, etc., usually behind a load balancer and TLS termination.

**How this repo supports it:** `Dockerfile`, `docker-compose.yml`, optional registry push from CI (not required for static AWS path).

| Aspect | Notes |
|--------|--------|
| **Fit for this app** | **Valid**, but the container is still **only serving static files**—same outcome as Method 1 unless you add a server-side layer. |
| **Cost (typical)** | **Higher** than pure static CDN: compute (tasks/nodes) **always or often running**, plus registry and LB costs. |
| **Operations** | **Higher**: image updates, task definitions, health checks, platform upgrades, sometimes cluster ops. |
| **Scaling** | **Manual/autoscaling rules** you configure (replicas, CPU/memory, HPA, etc.). |
| **Security surface** | **Larger**: OS + nginx in the image, registry supply chain, orchestrator IAM—more moving parts than S3+CloudFront alone. |
| **Deploy model** | **Image tags** per release; rollback = previous image digest/tag. |
| **Build-time config** | Same Vite constraints: secrets at build should use **BuildKit secrets** (as in your Dockerfile), not ARG/ENV for sensitive values. |
| **When it shines** | Same image in **dev/stage/prod**, integration with a **container-first** platform, or when you **add** server-side behavior in the same deployable (SSR, BFF, custom headers beyond nginx config). |

---

## Side-by-side summary

| Criteria | S3 + CloudFront | Docker + container platform |
|----------|-----------------|-------------------------------|
| Matches a static SPA + Supabase | Yes | Yes (still static inside the box) |
| Operational load | Lower | Higher |
| Typical cost at small/medium traffic | Lower | Higher |
| Global edge performance | Strong (CDN) | Depends on platform/regions |
| What you already automated in-repo | Terraform + `deploy-frontend.yml` | Image build; **orchestration not included** |
| Best if you want minimal infra | Yes | No |
| Best if standard is “everything in Kubernetes/ECS” | Possible but not required | Yes |

---

## Recommendation for **this** project

**Default choice: Method 1 — S3 + CloudFront (static deployment)**

Reasons:

1. **Architecture:** The UI is a static SPA; business logic and data live in **Supabase**, not in a Node server you ship. A CDN-backed static site is the usual, cost-effective pattern.
2. **Investment:** You already have **Terraform** and a **GitHub Actions** deploy path for S3/CloudFront. Finishing that path is less work than standing up a full container platform for the same outcome.
3. **Security and compliance posture:** Fewer long-lived servers and a smaller attack surface than running nginx containers 24/7—often easier to reason about for a **banking-style** frontend (still subject to your org’s rules).
4. **Cost and scaling:** Pay for storage and CDN transfer; scale at the edge without sizing clusters.

**Use Docker (Method 2) as:**

- **Local/staging parity** (“runs like prod”) and **CI** image builds—already valuable.
- **Production** if your organization **mandates** containers, or you later add **server-side** concerns (SSR, BFF, non-static behavior) that belong in the same deployment unit.

**Practical next step:** Treat **S3 + CloudFront + existing workflows** as production unless a hard requirement forces containers; keep the **Docker image** for developer workflow, optional staging, or future migration to a container platform.

---

## Quick reference

| Action | Static (S3 + CloudFront) | Docker |
|--------|---------------------------|--------|
| Infra as code | `terraform/` | Your choice (ECS, AKS, etc.—not in this repo by default) |
| Deploy automation | `.github/workflows/deploy-frontend.yml` | Build/push image + platform-specific deploy |
| Env for Vite build | GitHub Secrets in deploy workflow | CI secrets / BuildKit secrets |

---

*This document describes trade-offs for this repository’s stack; your security, compliance, and platform teams may override.*

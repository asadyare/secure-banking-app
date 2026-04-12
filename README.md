# Baawisan Bank (web app)

Vite + React + TypeScript + Tailwind + shadcn/ui, with Supabase for auth and data.

## Scripts

```sh
npm install
npm run dev
npm run build
npm run preview
npm test
npm run lint
```

## Git hooks (Husky)

After `npm install`, the **`prepare`** script registers Husky:

| Hook | What runs |
|------|-----------|
| **pre-commit** | **lint-staged** (ESLint on staged `*.{ts,tsx,js,jsx,mjs,cjs}`) → **gitleaks protect --staged** (blocks secrets in the commit) |
| **pre-push** | Full **`npm run lint`** → **`gitleaks detect`** on the repo (blocks push if either fails) |

If **lint** or **gitleaks** fails, the commit or push is **aborted**. Install **gitleaks** and ensure it is on your `PATH` ([install](https://github.com/gitleaks/gitleaks#installing)). Examples: `winget install gitleaks`, `choco install gitleaks`, `scoop install gitleaks`, `brew install gitleaks`.

To skip hooks (not recommended): `git commit --no-verify` / `git push --no-verify`.

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for local development.

## Supabase CLI

The CLI is installed as a dev dependency so you do **not** need a global `supabase` on your PATH. From the project root, use **`npx`** (or **`npm run supabase --`**):

```sh
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

On Windows, the same commands work in **PowerShell**, **cmd**, or **Git Bash**. If you prefer a global install: `npm install -g supabase`, then ensure your npm global `bin` folder is on your PATH.

## Stack

- Vite, React, React Router, TanStack Query
- Supabase (Auth + Postgres)
- Vitest, Playwright (E2E folder: `tests/e2e`)
- Terraform on AWS (see `terraform/README.md`), **Checkov** IaC scanning with custom policies (see `checkov/README.md` and `checkov.yaml`)

## Deployment

- **Static (recommended default):** S3 + CloudFront via Terraform; CI deploy in `.github/workflows/deploy-frontend.yml`. See `terraform/README.md`.
- **Go-live checklist (Terraform apply → GitHub secrets → deploy):** [docs/deploy-aws.md](docs/deploy-aws.md)
- **Docker:** `Dockerfile` + `docker-compose.yml` for local/staging-style runs; production containers are optional—see comparison below.

**[Static vs Docker — comparison and recommendation →](docs/deployment-comparison.md)**

# syntax=docker/dockerfile:1
# Production image: static Vite build served by nginx (SPA routing).
#
# Vite needs VITE_* at compile time. Pass them with a BuildKit secret (not ARG/ENV) so Docker
# does not flag SecretsUsedInArgOrEnv. The anon key is still emitted in dist/ (public client key; RLS enforces access).

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# File must contain KEY=value lines (same vars as .env.example), e.g. copied from .env.
# Build: docker build --secret id=supabase_env,src=.env -t secure-banking-app:local .
RUN --mount=type=secret,id=supabase_env \
    set -a && . /run/secrets/supabase_env && set +a && npm run build

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

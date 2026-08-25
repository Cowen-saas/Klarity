# Dev image shared by the `app` and `worker` Compose services (§3.1) — both run the
# same application code, only the container command differs (see docker-compose.yml).
# A separate production/multi-stage build is out of scope for Phase 0 (§10).
#
# Debian slim (glibc), not Alpine (musl): package-lock.json only has the
# lightningcss-linux-x64-gnu (glibc) native binary resolved, never the
# -musl variant, because the lockfile was generated on a glibc host. `npm ci`
# on Alpine can't install a package the lockfile never resolved for musl, so
# Tailwind v4 (via lightningcss) crashed on every page render. Swapping the
# base image is the minimal fix — it matches what's already in the lockfile
# instead of touching it (see docs/PROGRESS.md for the audit that found this).
FROM node:22-bookworm-slim

# bookworm-slim ships without openssl — Prisma's engine needs it to detect the
# libssl ABI to link against; without it, Prisma silently falls back to a
# guessed version ("Defaulting to openssl-1.1.x") instead of the real one.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

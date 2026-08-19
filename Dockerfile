# Dev image shared by the `app` and `worker` Compose services (§3.1) — both run the
# same application code, only the container command differs (see docker-compose.yml).
# A separate production/multi-stage build is out of scope for Phase 0 (§10).
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

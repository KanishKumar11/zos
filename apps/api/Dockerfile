# API Dockerfile
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @agency/shared build
RUN pnpm --filter @agency/api build

# --- Runtime stage ---
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# Puppeteer chromium deps
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_ENV=production
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages/shared ./packages/shared
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
RUN pnpm install --prod --frozen-lockfile=false

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

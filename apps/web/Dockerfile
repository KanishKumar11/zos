# Web Dockerfile
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
# Override any NODE_ENV build-arg so devDependencies (tsc, etc.) are installed
ENV NODE_ENV=development
WORKDIR /repo

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @agency/shared build
RUN pnpm --filter @agency/web build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages/shared ./packages/shared
COPY --from=builder /repo/apps/web/package.json ./apps/web/package.json
COPY --from=builder /repo/apps/web/.next ./apps/web/.next
COPY --from=builder /repo/apps/web/public ./apps/web/public
RUN pnpm install --prod --frozen-lockfile=false

EXPOSE 3000
CMD ["pnpm", "--filter", "@agency/web", "start"]

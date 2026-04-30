## Web Dockerfile (Next.js standalone-friendly multi-stage).
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
RUN pnpm --filter @agency/shared build && pnpm --filter @agency/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@agency/web", "start"]

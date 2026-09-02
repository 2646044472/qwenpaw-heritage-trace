FROM node:22-alpine AS dependencies

WORKDIR /workspace/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

FROM node:22-alpine AS build

WORKDIR /workspace/apps/web
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /workspace/apps/web/node_modules ./node_modules
COPY apps/web/ ./
COPY packages/contracts/ /workspace/packages/contracts/
# Keep contract code in sync with the pinned OpenAPI source before emitting
# Next's standalone output.
RUN npm run workflow:types && npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nextjs && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nextjs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /workspace/apps/web/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

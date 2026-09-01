FROM node:22-alpine

WORKDIR /workspace/apps/web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY apps/web/package.json apps/web/package-lock.json ./
# The image builds TypeScript/Next.js and runs the package's prepare hook;
# install devDependencies explicitly even though the final runtime is production.
RUN npm ci --include=dev --no-audit --no-fund

COPY apps/web/ ./
COPY packages/contracts/ /workspace/packages/contracts/
# Regenerate the contract types with the pinned dependency version, then build.
# This keeps the image reproducible even when generated formatting changes.
RUN npm run workflow:types && npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]

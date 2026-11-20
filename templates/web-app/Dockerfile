# One image for the app and its migration command. Multi-stage, non-root, port 8080.
# The base image is pinned by digest; Dependabot proposes updates.
ARG NODE_IMAGE=node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# @if db
# The migration job runs this same image with: node dist/migrate.js
COPY drizzle ./drizzle
# @endif
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]

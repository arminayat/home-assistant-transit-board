# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-alpine@sha256:6a1c190e17215d844926b0677f4bf87273ff7d5e54db06d3b5b5863ab0b09a3d
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /source
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
ARG BUILD_ARCH
ARG BUILD_VERSION=0.1.0-beta.3
ARG BUILD_REVISION=unknown
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./package.json
COPY --from=build /source/dist ./dist
# Standard Node images have no S6 overlay. Supervisor's default init is used.
# /data is a private, root-owned Supervisor mount; no host configuration is needed.
LABEL io.hass.type="app" \
      io.hass.arch="${BUILD_ARCH}" \
      io.hass.version="${BUILD_VERSION}" \
      io.hass.name="Transit Board" \
      io.hass.description="Shared Berlin and Brandenburg departure board" \
      io.hass.url="https://github.com/arminayat/home-assistant-transit-board" \
      org.opencontainers.image.title="Transit Board" \
      org.opencontainers.image.description="Shared Berlin and Brandenburg departure board" \
      org.opencontainers.image.source="https://github.com/arminayat/home-assistant-transit-board" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.revision="${BUILD_REVISION}"
EXPOSE 8099
CMD ["node", "dist/server.js"]

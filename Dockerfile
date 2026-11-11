# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Global build args. They MUST be declared before the first FROM: only global
# ARGs are available for substitution in FROM lines. ARGs declared inside a
# stage are stage-scoped and cannot be used by a later FROM.
# Override with: docker build --build-arg NODE_VERSION=22-alpine ...
# ---------------------------------------------------------------------------
ARG NODE_VERSION=24-alpine
ARG NGINX_IMAGE=nginx:stable-alpine

# ---------------------------------------------------------------------------
# Stage 1 — build the static bundle
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Install dependencies first: this layer is cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Copy the sources and build the production bundle (Vite -> /app/dist).
COPY . .

# Same-origin Kroki endpoint baked into the SPA. Keep the default in sync with
# the `/kroki/` proxy location in nginx.conf and KROKI_PUBLIC_URL in compose.
ARG VITE_KROKI_URL=/kroki
ENV VITE_KROKI_URL=${VITE_KROKI_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — serve the bundle with a minimal nginx (alpine)
# ---------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

LABEL org.opencontainers.image.title="ascii-wysiwyg" \
      org.opencontainers.image.description="AsciiDoc WYSIWYG editor (Vite + React static bundle)" \
      org.opencontainers.image.source="https://github.com/"

# Replace the stock server config with the SPA-aware one.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Only the built static files end up in the final image.
COPY --from=build /app/dist /usr/share/nginx/html

# nginx listens on 80 inside the container and binds to all interfaces.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

# The official image already runs `nginx -g 'daemon off;'`; kept explicit.
CMD ["nginx", "-g", "daemon off;"]

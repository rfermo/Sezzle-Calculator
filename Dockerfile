# syntax=docker/dockerfile:1

# Stage 1: build the frontend. Dependencies are installed before the sources are copied so edits
# to src/ do not invalidate the npm layer.
FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: build a static Go binary, so the runtime stage needs no libc or Go toolchain.
FROM golang:1.27-alpine AS backend
WORKDIR /build
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# Stage 3: runtime. Alpine rather than scratch because the HEALTHCHECK needs busybox's wget.
FROM alpine:3.22
RUN adduser -D -H -u 10001 app
WORKDIR /app
COPY --from=backend /out/server ./server
COPY --from=frontend /build/dist ./public

ENV PORT=8080 \
    STATIC_DIR=/app/public
USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/app/server"]

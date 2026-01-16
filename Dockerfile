# syntax=docker/dockerfile:1

# =============================================================================
# Multi-stage Dockerfile for Fider (Roadmap/Feedback Platform)
# Optimized for ARM64 (AWS Graviton)
# =============================================================================
#
# Build Requirements:
#   - Memory: ~2GB during build
#   - CPU: 1+ cores recommended
#   - Disk: ~1.5GB for build layers
#
# Runtime Requirements:
#   - Shared PostgreSQL database (futto-landing-postgres)
#   - Shared network (futto-landing-network)
#   - Email SMTP configuration (Brevo)
# =============================================================================

#####################
### Server Build Step
#####################
FROM --platform=${TARGETPLATFORM:-linux/amd64} golang:1.24-bookworm AS server-builder

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    libc6-dev

RUN mkdir /server
WORKDIR /server

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . ./

ARG COMMITHASH
ARG VERSION
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    COMMITHASH=${COMMITHASH} VERSION=${VERSION} GOOS=${TARGETOS} GOARCH=${TARGETARCH} make build-server

#################
### UI Build Step
#################
FROM --platform=${TARGETPLATFORM:-linux/amd64} node:22-bookworm AS ui-builder

WORKDIR /ui

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --maxsockets 1

COPY . .
RUN make build-ssr
RUN make build-ui

################
### Runtime Step
################
FROM --platform=${TARGETPLATFORM:-linux/amd64} debian:bookworm-slim AS runtime

# =============================================================================
# Build Arguments - Fider Configuration
# =============================================================================
# These arguments are passed during docker build and baked into the image
# They will be written to .env file for runtime configuration
# =============================================================================

# Fider Core Configuration
ARG PORT=3005
ARG BASE_URL
ARG JWT_SECRET

# Database Configuration
ARG FIDER_DB_PASSWORD
# DATABASE_URL is constructed from FIDER_DB_PASSWORD
# Format: postgresql://fider_user:PASSWORD@futto-landing-postgres:5432/fider?sslmode=disable

# Email Configuration (Brevo SMTP)
ARG BREVO_NOREPLY
ARG BREVO_SMTP_HOST
ARG BREVO_SMTP_USERNAME
ARG BREVO_SMTP_PASSWORD

# Optional: Build metadata
ARG ENVIRONMENT=production
ARG COMMITHASH
ARG VERSION

# =============================================================================
# Install Runtime Dependencies
# =============================================================================
RUN apt-get update && apt-get install -y ca-certificates wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =============================================================================
# Copy Built Artifacts from Previous Stages
# =============================================================================
COPY --from=server-builder /server/migrations /app/migrations
COPY --from=server-builder /server/views /app/views
COPY --from=server-builder /server/locale /app/locale
COPY --from=server-builder /server/LICENSE /app
COPY --from=server-builder /server/fider /app

COPY --from=ui-builder /ui/favicon.png /app
COPY --from=ui-builder /ui/dist /app/dist
COPY --from=ui-builder /ui/robots.txt /app
COPY --from=ui-builder /ui/ssr.js /app

# =============================================================================
# Generate .env File for Runtime Configuration
# =============================================================================
# Create .env file with all required Fider environment variables
# This ensures all configuration is documented and available at runtime
# =============================================================================
RUN echo "# Generated at build time - Fider Configuration" > .env && \
    echo "# Environment: ${ENVIRONMENT}" >> .env && \
    echo "" >> .env && \
    echo "# Core Configuration" >> .env && \
    echo "PORT=${PORT}" >> .env && \
    echo "BASE_URL=${BASE_URL}" >> .env && \
    echo "JWT_SECRET=${JWT_SECRET}" >> .env && \
    echo "" >> .env && \
    echo "# Database Configuration" >> .env && \
    echo "DATABASE_URL=postgresql://fider_user:${FIDER_DB_PASSWORD}@futto-landing-postgres:5432/fider?sslmode=disable" >> .env && \
    echo "" >> .env && \
    echo "# Email Configuration (Brevo SMTP)" >> .env && \
    echo "EMAIL_NOREPLY=${BREVO_NOREPLY}" >> .env && \
    echo "EMAIL_SMTP_HOST=${BREVO_SMTP_HOST}" >> .env && \
    echo "EMAIL_SMTP_PORT=587" >> .env && \
    echo "EMAIL_SMTP_USERNAME=${BREVO_SMTP_USERNAME}" >> .env && \
    echo "EMAIL_SMTP_PASSWORD=${BREVO_SMTP_PASSWORD}" >> .env && \
    echo "EMAIL_SMTP_ENABLE_STARTTLS=true" >> .env && \
    echo "" >> .env && \
    echo "# Build Metadata" >> .env && \
    if [ -n "$COMMITHASH" ]; then echo "COMMITHASH=${COMMITHASH}" >> .env; fi && \
    if [ -n "$VERSION" ]; then echo "VERSION=${VERSION}" >> .env; fi

# =============================================================================
# Security: Create Non-Root User
# =============================================================================
RUN groupadd -r fider && useradd -r -g fider fider && \
    chown -R fider:fider /app

USER fider

# =============================================================================
# Container Configuration
# =============================================================================
EXPOSE 3005

HEALTHCHECK --timeout=5s --interval=30s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3005/api/health || exit 1

# Run migrations then start Fider
CMD ./fider migrate && ./fider

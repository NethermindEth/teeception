
# Build
# ----------

FROM golang:1.23-bookworm AS builder

WORKDIR /deps

# Download chromium
RUN curl -L https://freeshell.de/phd/chromium/jammy/pool/chromium_130.0.6723.58~linuxmint1+virginia/chromium_130.0.6723.58~linuxmint1+virginia_amd64.deb -o chromium.deb

WORKDIR /app

# Cache dependencies
COPY go.* ./
RUN go mod download

COPY . ./
RUN go build -v -o agent cmd/agent/main.go

# Runtime
# ----------

FROM debian:bookworm-slim

# Install package dependencies and remove apt lists
RUN set -x && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    python3 \
    perl \
    libgbm1 \
    libgl1 \
    libglx-mesa0 \
    libgtk-3-0 \
    libnss3 \
    libsecret-1-0 \
    libxss1 \
    shared-mime-info \
    libxshmfence1 \
    libasound2 && \
    rm -rf /var/lib/apt/lists/*

# Install chromium
COPY --from=builder /deps/chromium.deb /deps/chromium.deb
RUN apt-get install -y /deps/chromium.deb && rm -rf /deps/chromium.deb

# Copy agent binary
COPY --from=builder /app/agent /app/agent

# Execute agent
ENTRYPOINT ["/app/agent"]

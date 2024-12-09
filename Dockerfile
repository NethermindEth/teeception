
# Build
# ----------

FROM golang:1.23-bookworm AS builder

WORKDIR /deps

# Download chromium
RUN curl -LO https://freeshell.de/phd/chromium/jammy/pool/chromium_130.0.6723.58~linuxmint1+virginia/chromium_130.0.6723.58~linuxmint1+virginia_amd64.deb -o chromium.deb

WORKDIR /app

# Cache dependencies
COPY go.* ./
RUN go mod download

COPY . ./
RUN go build -v cmd/agent/main.go -o agent

# Runtime
# ----------

FROM debian:bookworm-slim

RUN set -x && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /deps/chromium.deb /deps/chromium.deb

RUN apt-get install -y /deps/chromium.deb && rm -rf /deps/chromium.deb
RUN apt-get install -y libasound2

COPY --from=builder /app/agent /app/agent

ENTRYPOINT ["/app/agent"]

# Build
# ----------

FROM golang:1.23-bookworm AS builder

WORKDIR /app

COPY go.* ./
RUN go mod download

COPY . ./
RUN go build -v -o ui_service cmd/ui_service/main.go

# Runtime
# ----------

FROM debian:bookworm-slim

RUN set -x && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates

WORKDIR /app

COPY --from=builder /app/ui_service /app/ui_service

ENTRYPOINT ["/app/ui_service"]

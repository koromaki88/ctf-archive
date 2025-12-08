###########################################################################
# Minimal, portable Dockerfile for chall_rust (CTF service via nc host:port)
# - Builds Rust binary in a builder stage
# - Runs as an unprivileged user
# - Uses socat to accept TCP and exec the binary
# - Avoids gosu/arch-specific downloads to prevent exec format issues
###########################################################################

FROM rust:1.70-bullseye AS builder
WORKDIR /src

# Build deps for openssl-backed crates
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

# Leverage Docker layer caching for dependencies
COPY chall_rust/Cargo.toml chall_rust/Cargo.lock ./
RUN mkdir -p src && echo 'fn main(){}' > src/main.rs && cargo build --release || true

# Copy full source and build
COPY chall_rust/ ./
# Handle newer lockfile versions by rebuilding lock inside the container if needed
RUN rm -f Cargo.lock || true
RUN cargo build --release

FROM debian:bullseye-slim
ARG PORT=1337
ENV PORT=${PORT}

# Runtime deps: socat + libssl (for openssl-linked Rust binary)
RUN apt-get update && apt-get install -y --no-install-recommends \
    socat ca-certificates libssl1.1 \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged user
RUN useradd -r -m -d /home/ctf -s /usr/sbin/nologin ctf

# App
COPY --from=builder /src/target/release/chall_rust /app/chall_rust
RUN chmod 0755 /app/chall_rust && chown ctf:ctf /app/chall_rust

# Simple entrypoint: listen and exec the binary (no gosu needed since USER is ctf)
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -eu' \
  ': ${PORT:=1337}' \
  'echo "Starting challenge on port ${PORT}"' \
  'exec socat TCP-LISTEN:${PORT},reuseaddr,fork EXEC:/app/chall_rust,pty,stderr' \
  > /entrypoint.sh \
  && chmod +x /entrypoint.sh \
  && chown ctf:ctf /entrypoint.sh

USER ctf
EXPOSE ${PORT}
ENTRYPOINT ["/entrypoint.sh"]

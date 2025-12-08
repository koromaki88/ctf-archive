ARG TARGETPLATFORM=linux/amd64
FROM debian:bookworm-slim

ARG FLAG="W1{flag_placeholder}"
ARG PORT=31337

ENV FLAG="${FLAG}"
ENV PORT="${PORT}"
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libudev-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-built artifacts from bin/ directory
COPY bin/dragons-hoard-server /app/dragons-hoard-server
COPY bin/dragons_hoard.so /app/dragons_hoard.so

RUN chmod +x /app/dragons-hoard-server

EXPOSE 31337

CMD ["/app/dragons-hoard-server"]

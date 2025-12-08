# Runtime image for VIP Lounge CTF Challenge
# Uses pre-built artifacts from build_artifacts.sh
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
COPY bin/vip-lounge-server /app/vip-lounge-server
COPY bin/vip_lounge.so /app/vip_lounge.so

RUN chmod +x /app/vip-lounge-server

EXPOSE 31337

CMD ["/app/vip-lounge-server"]


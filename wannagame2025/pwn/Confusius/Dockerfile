# Runtime-only image that serves the prebuilt chall using redpwn/jail
FROM ubuntu:22.04 AS app
ENV DEBIAN_FRONTEND=noninteractive TZ=UTC
RUN apt-get update \
    && apt-get install -yq --no-install-recommends \
    git \
    python3 \
    ca-certificates \
    curl \
    tar \
    xz-utils \
    build-essential \
    lsb-release \
    sudo \
    file socat

RUN /usr/sbin/useradd --no-create-home -u 1000 user

COPY flag.txt /flag.txt
COPY run.py /home/user/
COPY d8 snapshot_blob.bin /home/user/

RUN chmod 444 /flag.txt && \
  chmod 555 /home/user/run.py && \
  chmod 555 /home/user/d8 && \
  chmod 444 /home/user/snapshot_blob.bin

EXPOSE 6100/tcp
  
CMD socat \
      TCP-LISTEN:6100,reuseaddr,fork \
      EXEC:"/home/user/run.py"

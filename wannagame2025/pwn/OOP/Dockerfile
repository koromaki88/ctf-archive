FROM ubuntu:22.04 AS app
ENV DEBIAN_FRONTEND=noninteractive TZ=UTC
RUN apt-get update \
    && apt-get install -yq --no-install-recommends \
    build-essential \
    g++

RUN /usr/sbin/useradd --no-create-home -u 1000 user

COPY chall /home/user/
RUN chmod +x /home/user/run.sh

RUN chmod 555 /home/user/chall 
RUN echo "W1{example_flag_GLHF}" > /flag.txt
EXPOSE 9634/tcp
CMD  socat \
      TCP-LISTEN:9634,reuseaddr,fork \
      EXEC:"/home/user/chall"

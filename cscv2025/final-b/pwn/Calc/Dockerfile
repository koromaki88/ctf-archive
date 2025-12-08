FROM ubuntu:22.04

MAINTAINER anonymous
RUN apt-get update

RUN useradd -m dummy
RUN apt-get install -y socat

WORKDIR /home/dummy

ADD ./flag /
ADD ./calc /home/dummy
RUN chmod +x /home/dummy/calc

ENTRYPOINT ["sh", "-c", "exec socat TCP-LISTEN:1337,reuseaddr,fork EXEC:/home/dummy/calc"]

EXPOSE 1337
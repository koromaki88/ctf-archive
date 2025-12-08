FROM ubuntu:22.04

RUN apt update && apt install -y xxd python3-pip openjdk-11-jre-headless dotnet-runtime-6.0 && rm -rf /var/lib/apt/lists/*
RUN pip install pycryptodome

RUN mkdir /app
COPY app /app
RUN chmod +x /app/run.sh
WORKDIR /app

ENTRYPOINT /app/run.sh
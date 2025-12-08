FROM ubuntu:22.04

RUN apt-get update && apt-get install -y curl socat build-essential 
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

COPY Cargo.toml Cargo.lock /app/

RUN mkdir /app/src

COPY src /app/src

WORKDIR /app

RUN cargo build --release

CMD socat TCP-LISTEN:1503,reuseaddr,fork EXEC:"target/release/king_halo"
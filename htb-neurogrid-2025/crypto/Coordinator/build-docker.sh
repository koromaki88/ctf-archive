#!/bin/bash
NAME="coordinator"
docker rm -f crypto_$NAME
docker build --tag=crypto_$NAME .
if [ -z "$1" ]; then
    DEBUG="--detach"
elif [[ "$1" == "debug" ]]; then
    DEBUG=""
fi
docker run -p 1337:1337 --rm --name=crypto_$NAME $DEBUG crypto_$NAME

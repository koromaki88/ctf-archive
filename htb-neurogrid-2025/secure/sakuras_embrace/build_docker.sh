#!/usr/bin/bash

docker build -t secure_coding_sakuras_embrace .
docker run -it --rm --name secure_coding_sakuras_embrace -p 1337:1337 secure_coding_sakuras_embrace
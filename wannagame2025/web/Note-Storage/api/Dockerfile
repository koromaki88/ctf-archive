FROM node:slim@sha256:f2cf744a59dcdd05b354754704a527de9fb0c5d8e924b0fc3628dedc23573c39

# For nodejs
WORKDIR /app
COPY ./index.js ./lib.js ./package.json ./package-lock.json ./
RUN npm install

EXPOSE 1337
ENTRYPOINT [ "/app/index.js" ]
FROM node:20

WORKDIR /app
COPY src ./

RUN npm install
RUN chown -R node:node /app

USER node
EXPOSE 3000
CMD ["npm", "start"]

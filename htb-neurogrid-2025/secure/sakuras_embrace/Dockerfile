# Editor Assets for Frontend
# FROM node:20-alpine AS editor-builder
# 
# WORKDIR /editor
# COPY editor/frontend/package*.json ./
# RUN npm install --no-audit --no-fund
# COPY editor/frontend/ ./
# RUN npm run build

# Final Builder is a Node JS image
FROM node:25-alpine AS final-build

# ADD USERS TO MANAGE PERMISSIONS
RUN addgroup -S challenger && adduser -S challenger -G challenger \
    && addgroup -S editor && adduser -S editor -G editor -s /bin/bash \
    && addgroup editor challenger

# First align and copy the editor assets and the backend
RUN mkdir /app && chown editor:challenger /app
# COPY --chown=editor:editor --chmod=770 --from=editor-builder /editor/dist /app/editor/backend/static
# COPY --chown=editor:editor --chmod=770 editor/backend /app/editor/backend

RUN apk add --no-cache caddy supervisor bash curl tzdata git icu-dev oniguruma-dev libzip-dev python3 py3-pip
# RUN pip install --break-system-packages --no-cache-dir flask requests aiohttp flask-socketio flask-cors

# Build main app
WORKDIR /app/main_app

COPY challenge/app/package*.json ./
RUN npm install --no-audit --no-fund
COPY challenge/app ./

# Make necessary directories
RUN mkdir -p /var/log/node /var/log/caddy \
    && chown -R challenger:challenger /var/log/node \
    && chmod 755 /var/log \
    && chmod 775 /var/log/node /var/log/caddy


RUN chown -R editor:challenger /app/main_app && \
    chmod -R 777 /app/main_app

# ROOT'S PASSWORD
RUN echo "root:HIDDEN_FROM_PLAYER" | chpasswd && chmod ug+s /bin/su

# COPY CONFIG FILES
COPY --chown=root:root --chmod=770 config/supervisord.conf /etc/supervisord.conf
COPY --chown=root:root --chmod=770 config/Caddyfile /etc/caddy/Caddyfile

COPY --chown=root:root --chmod=770 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --chown=root:editor --chmod=640 flag.txt /flag.txt

# INITIALIZE AND RUN THE APP
EXPOSE 1337
CMD ["/usr/local/bin/entrypoint.sh"]
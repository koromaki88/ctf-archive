FROM nginx:1.27.3-alpine

RUN apk add --no-cache openssl bash

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/*.conf /etc/nginx/conf.d/

COPY nginx/html/certs-index.html /usr/share/nginx/html/certs-index.html
RUN chmod 644 /usr/share/nginx/html/certs-index.html

COPY nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /var/log/nginx /etc/nginx/certs && \
    chmod 755 /var/log/nginx && \
    chmod 755 /etc/nginx/certs

RUN addgroup -g 101 -S nginx 2>/dev/null || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx 2>/dev/null || true

EXPOSE 8443

ENTRYPOINT ["/entrypoint.sh"]

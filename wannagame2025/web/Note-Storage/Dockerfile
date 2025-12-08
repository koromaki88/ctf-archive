FROM ubuntu:24.04@sha256:3afff29dffbc200d202546dc6c4f614edc3b109691e7ab4aa23d02b42ba86790

RUN apt-get update && DEBIAN_FRONTEND="noninteractive" apt-get install tzdata \
    supervisor \
    python3 \
    python3-pip \
    nginx -y


# for python
WORKDIR /app/
RUN apt install python3-requests python3-flask -y
COPY ./backend/app.py /app

# supervisord
COPY ./supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY ./nginx/default.conf /etc/nginx/sites-available/default

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
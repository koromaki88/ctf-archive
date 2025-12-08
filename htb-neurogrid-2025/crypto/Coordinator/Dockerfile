FROM python:3.13-slim 

RUN apt update
RUN pip3 install Flask

RUN mkdir app

WORKDIR /app/application

COPY challenge/application .
COPY flag.txt /flag.txt

EXPOSE 1337

ENV PYTHONDONTWRITEBYTECODE=1

ENTRYPOINT ["python3", "/app/application/app.py"]

FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m web
WORKDIR /app
COPY ./app /app
COPY requirements.txt /app

# Download model during build
RUN mkdir -p /app/models && \
    curl -L https://huggingface.co/Qwen/Qwen1.5-0.5B-Chat-GGUF/resolve/main/qwen1_5-0_5b-chat-q4_0.gguf -o /app/models/qwen1_5-0_5b-chat-q4_0.gguf

RUN pip install --no-cache-dir -r requirements.txt
RUN FLAG_NAME=$(head /dev/urandom | tr -dc a-z0-9 | head -c 32) && \
    echo "CSCV2025{Fake_flag}" > /${FLAG_NAME}.txt && \
    chmod 444 /${FLAG_NAME}.txt

RUN chown -R root:root /app && \
    chmod -R 555 /app

RUN mkdir /app/db  && \
    chmod 755 /app/db && \
    chown web:web /app/db

USER web

EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers=1", "--timeout=60","app:app"]

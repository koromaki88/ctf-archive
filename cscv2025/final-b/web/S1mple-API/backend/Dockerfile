FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./flag.txt /flag.txt
COPY ./src .

RUN mkdir -p /app/data &&\
    useradd -m appuser &&\
    chown -R appuser:appuser /app && \
    chmod -R 555 /app && \
    chmod 755 /app/data && \
    RAND_NAME=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 16) && \
    mv /flag.txt "/${RAND_NAME}" && \
    rm -f /flag.txt && \
    chown root:root "/${RAND_NAME}" && chmod 444 "/${RAND_NAME}"

USER appuser

EXPOSE 5555

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5555"]

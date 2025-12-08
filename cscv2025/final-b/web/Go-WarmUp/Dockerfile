FROM golang:1.24.5 AS builder
WORKDIR /app

COPY chall/go.mod chall/go.sum ./
RUN go mod download

COPY chall/ ./

RUN CGO_ENABLED=0 GOOS=linux go build -o go-warmup ./cmd/runner.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/go-warmup .
EXPOSE 3000
CMD ["./go-warmup"]

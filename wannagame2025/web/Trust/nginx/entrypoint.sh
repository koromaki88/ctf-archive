#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"

if [ -f "$CERT_DIR/ca.crt" ] && [ -f "$CERT_DIR/server.crt" ]; then
    echo "[✓] Certificates exist, skipping generation"
else
    echo "[*] Generating certificates..."
    cd "$CERT_DIR"

    openssl genrsa -out ca.key 4096 2>/dev/null
    openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -sha256 \
        -subj "/C=US/ST=California/L=San Francisco/O=TrustBoundary Inc/OU=Security/CN=TrustBoundary Root CA" 2>/dev/null

    openssl genrsa -out trusted-ca.key 4096 2>/dev/null
    openssl req -new -x509 -days 3650 -key trusted-ca.key -out trusted-ca.crt -sha256 \
        -subj "/C=US/ST=California/L=San Francisco/O=TrustBoundary Inc/OU=HR/CN=TrustBoundary Employee CA" 2>/dev/null

    openssl genrsa -out server.key 2048 2>/dev/null
    openssl req -new -key server.key -out server.csr \
        -subj "/C=US/ST=California/L=San Francisco/O=TrustBoundary Inc/OU=IT/CN=*.trustboundary.local" 2>/dev/null

    cat > server_ext.cnf << EOF
[v3_req]
subjectAltName = @alt_names
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = *.trustboundary.local
DNS.2 = trustboundary.local
DNS.3 = public.trustboundary.local
DNS.4 = employee.trustboundary.local
EOF

    openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
        -out server.crt -days 3650 -sha256 -extfile server_ext.cnf -extensions v3_req 2>/dev/null

    openssl genrsa -out trusted-client.key 2048 2>/dev/null
    openssl req -new -key trusted-client.key -out trusted-client.csr \
        -subj "/C=US/ST=California/L=San Francisco/O=TrustBoundary Inc/OU=Engineering/CN=john.employee@trustboundary.local" 2>/dev/null

    openssl x509 -req -in trusted-client.csr -CA trusted-ca.crt -CAkey trusted-ca.key \
        -CAcreateserial -out trusted-client.crt -days 3650 -sha256 2>/dev/null

    openssl genrsa -out untrusted-ca.key 4096 2>/dev/null
    openssl req -new -x509 -days 3650 -key untrusted-ca.key -out untrusted-ca.crt -sha256 \
        -subj "/C=US/ST=NewYork/L=NewYork/O=Untrusted Corp/OU=Users/CN=Untrusted CA" 2>/dev/null

    openssl genrsa -out untrusted-client.key 2048 2>/dev/null
    openssl req -new -key untrusted-client.key -out untrusted-client.csr \
        -subj "/C=US/ST=NewYork/L=NewYork/O=Untrusted Corp/OU=Users/CN=attacker@untrusted.com" 2>/dev/null

    openssl x509 -req -in untrusted-client.csr -CA untrusted-ca.crt -CAkey untrusted-ca.key \
        -CAcreateserial -out untrusted-client.crt -days 3650 -sha256 2>/dev/null

    rm -f *.csr *.srl server_ext.cnf

    chmod 644 *.crt
    chmod 600 *.key
    chmod 644 untrusted-client.key

    echo "[✓] Certificate generation complete"
fi

echo "[*] Starting nginx..."
exec nginx -g 'daemon off;'

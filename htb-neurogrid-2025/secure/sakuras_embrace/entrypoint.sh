#!/bin/sh

echo "127.0.0.1 sakuras_embrace.htb" >> /etc/hosts

# Set Flag
RNDOM1=$(cat /dev/urandom | tr -dc 'a-e0-9' | fold -w 32 | head -n 1)
FLAGNAME=$(echo "$RNDOM1.txt" | tr -d ' ')

chown root:editor /flag.txt
mv /flag.txt "/$FLAGNAME" && chmod 440 "/$FLAGNAME"

touch /var/log/node/access.log
touch /var/log/node/error.log

chmod -R 777 /var/log/node/

/usr/bin/supervisord -c /etc/supervisord.conf
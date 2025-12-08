FROM tomcat:9.0-jdk11-openjdk-slim

RUN apt-get update && apt-get install -y curl gcc openssl && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 -s /bin/bash ctf

COPY backend/pluginmanager.war /usr/local/tomcat/webapps/ROOT.war

RUN rm -rf /usr/local/tomcat/webapps/ROOT && \
    chown -R ctf:ctf /usr/local/tomcat/webapps

RUN mkdir -p /opt/tomcat/plugins/uploads

COPY sample-plugins/*.plugin /opt/tomcat/plugins/uploads/

RUN chown -R ctf:ctf /opt/tomcat/plugins && \
    chmod 755 /opt/tomcat/plugins/uploads

COPY certs/plugin-ca.crt /usr/local/share/ca-certificates/plugin-ca.crt
RUN update-ca-certificates

COPY backend/readflag.c /tmp/readflag.c
RUN gcc /tmp/readflag.c -o /readflag && \
    rm /tmp/readflag.c && \
    chown root:root /readflag && \
    chmod 4755 /readflag

COPY backend/flag.txt /flag.txt
RUN chmod 400 /flag.txt && chown root:root /flag.txt

USER ctf

EXPOSE 8080

CMD ["catalina.sh", "run"]

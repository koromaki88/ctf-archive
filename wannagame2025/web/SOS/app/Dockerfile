FROM jetty:11-jre21-alpine

USER root

RUN rm -rf /var/lib/jetty/webapps/*

ENV JAVA_OPTIONS=""
ENV JAVA_OPTIONS="${JAVA_OPTIONS} --add-exports=java.base/jdk.internal.misc=ALL-UNNAMED --add-opens=java.desktop/com.sun.beans.decoder=ALL-UNNAMED"


RUN mkdir -p /var/lib/jetty/start.d \
    && echo "jetty.http.port=9099" > /var/lib/jetty/start.d/http-port.ini

COPY flag.txt /flag.txt

USER jetty

COPY SimpleApp.war /var/lib/jetty/webapps/ROOT.war

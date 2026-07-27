FROM caddy:2.10.2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile

RUN setcap -r /usr/bin/caddy \
  && addgroup -S -g 10001 ngapd \
  && adduser -S -D -H -u 10001 -G ngapd ngapd \
  && chown -R 10001:10001 /config /data

USER 10001:10001
EXPOSE 8080 8443 8443/udp 9090

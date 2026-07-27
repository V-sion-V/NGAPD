FROM caddy:2.10.2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile

RUN chown -R caddy:caddy /config /data

USER caddy
EXPOSE 8080 8443 8443/udp 9090

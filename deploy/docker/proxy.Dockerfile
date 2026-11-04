# syntax=docker/dockerfile:1.7
# Proxy depan Kira: Caddy dengan salinan berkas statis dari image web (diberikan sebagai konteks "web" oleh docker-compose.yml).
FROM caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5
COPY --from=web /app/apps/web/.next/static /srv/static/_next/static
COPY --from=web /app/apps/web/public /srv/public
COPY deploy/proxy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/proxy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /srv/media
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]

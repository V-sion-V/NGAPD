ARG NODE_VERSION=24.18.0
ARG PNPM_VERSION=11.9.0
ARG CADDY_VERSION=2.10.2

FROM node:${NODE_VERSION}-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

ARG PNPM_VERSION
RUN corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build /workspace /workspace

RUN mkdir -p /var/lib/ngapd/objects /var/lib/ngapd/backups \
  && chown -R node:node /var/lib/ngapd

USER node

FROM runtime AS api
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]

FROM runtime AS worker
EXPOSE 3001
CMD ["node", "apps/worker/dist/index.js"]

FROM caddy:${CADDY_VERSION}-alpine AS web

COPY deploy/Web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=caddy:caddy /workspace/apps/web/dist /srv

RUN chown -R caddy:caddy /config /data

USER caddy
EXPOSE 8080

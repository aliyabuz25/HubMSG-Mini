FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    npm_config_strict_ssl=true

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund \
    || npm install --omit=dev --no-audit --no-fund --prefer-offline

COPY server.js sessions.js ./
COPY public ./public

RUN mkdir -p /app/data/sessions

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]

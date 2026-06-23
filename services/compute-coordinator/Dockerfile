FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
RUN addgroup -S aios && adduser -S aios -G aios && mkdir -p /data && chown -R aios:aios /data
USER aios
EXPOSE 8787
CMD ["node", "src/server.mjs"]

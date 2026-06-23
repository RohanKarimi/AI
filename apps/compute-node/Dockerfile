FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN addgroup -S aios && adduser -S aios -G aios && mkdir -p /keys && chown -R aios:aios /app /keys
USER aios
ENV KEYS_DIR=/keys
CMD ["node", "src/index.mjs"]

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY src ./src
COPY ios/RetroFront/Game ./ios/RetroFront/Game
ENV PORT=8787 NODE_ENV=production
EXPOSE 8787
USER node
CMD ["node", "server/index.mjs"]

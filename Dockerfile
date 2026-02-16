# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/migrations ./dist/database/migrations
COPY --from=builder /app/src/database/data-source.js ./dist/database/data-source.js  # <-- ADD THIS

ENV NODE_ENV=production
EXPOSE 8000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
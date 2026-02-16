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

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY package*.json ./
# Added --ignore-scripts to prevent 'nest' command failures in postinstall
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy the built application (this INCLUDES compiled migrations in dist/database/migrations)
COPY --from=builder /app/dist ./dist

# Heroku sets PORT dynamically, don't hardcode it
ENV NODE_ENV=production

EXPOSE 8000

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Reverted to dist/main.js (Standard NestJS path)
CMD ["node", "dist/main.js"]
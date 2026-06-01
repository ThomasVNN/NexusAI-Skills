FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=true

# Install build dependencies
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with clean install (more reliable in Docker)
RUN npm ci --prefer-offline --no-audit --no-fund || npm install --prefer-offline --no-audit --no-fund

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 8083
ENV PORT=8083
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

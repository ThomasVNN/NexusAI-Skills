FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=true

# Install build dependencies
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy source first
COPY . .

# Install dependencies with npm
RUN npm install

# Build TypeScript
RUN npm run build

EXPOSE 8083
ENV PORT=8083
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

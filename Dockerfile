FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=true

# Install build dependencies
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install all dependencies
RUN npm install -g pnpm && pnpm install --ignore-scripts

COPY . .

# Build TypeScript
RUN pnpm build

EXPOSE 8083
ENV PORT=8083
ENV NODE_ENV=production

CMD ["pnpm", "start"]

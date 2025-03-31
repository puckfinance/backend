FROM node:18 AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --frozen

COPY . .

RUN pnpm prisma:generate
RUN pnpm build

# Set CI=true to skip husky installation in Docker
ENV CI=true
RUN pnpm prune --prod

FROM node:18-alpine

# Install tini for better process handling
RUN apk add --no-cache tini

WORKDIR /app

COPY --from=builder /app/built ./built
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set production environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
# Increase Node memory limits for production
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
# Set timeout for handling slow requests without crashing
ENV TIMEOUT=120000

# Ensure proper kernel signal handling with tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "./built/server.js"]

# Add healthcheck to help Docker detect and restart unhealthy containers
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:80/ || exit 1

# Expose the application port
EXPOSE 80

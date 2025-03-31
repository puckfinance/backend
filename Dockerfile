FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN apk add --no-cache libc6-compat python3 make g++ && \
    npm install -g pnpm && \
    pnpm install --frozen-lockfile --no-optional

COPY . .

RUN pnpm prisma:generate && \
    pnpm build && \
    pnpm prune --prod && \
    rm -rf src tests .git .github .next/cache

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/built ./built
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 80

CMD ["node", "./built/server.js"]

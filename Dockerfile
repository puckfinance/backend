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

COPY --from=builder /app/built ./built
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 80

CMD ["node", "./built/server.js"]

FROM node:18 AS builder

WORKDIR /home/node/app

COPY ../package.json ./

RUN npm install

COPY ../. ./

ARG DATABASE_URL

ENV DATABASE_URL $DATABASE_URL

RUN npm run prisma:generate
RUN npm run prisma:db:push
RUN npm run build
RUN npm prune --production


FROM node:18-slim


COPY --from=builder /home/node/app/node_modules ./node_modules
COPY --from=builder /home/node/app/dist ./dist

ARG PORT

EXPOSE $PORT
CMD ["node", "./dist/src/server.js"]

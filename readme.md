# srve-backend

A Node.js + TypeScript backend application that provides a server for your application.

## Prerequisites

- Start services using `docker-compose up -d`
- Migrate database using `npm run prisma:migrate:dev`
- Seed database using `npm run prisma:seed`

## Getting started with local development

First setup database. `docker-compose up -d` to run local postgres database container

- `cp .env.example .env` and setup environment variables (DATABASE_URL, JWT_SECRET e.G)
- `npm run dev` to start development server

## Prisma ORM usage

- `npm run prisma:studio` to start database inspect tool
- `npm run prisma:db:push` to apply soft database migrations

## Fly.io configuration

### Postgres

[Deployment steps](https://fly.io/docs/postgres/connecting/)

Update postgres container

```
fly deploy --config ./fly.io/srve-database-development.toml
```

## Backend API

```
fly deploy --config ./fly.io/srve-backend-development.toml
```

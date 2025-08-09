# Setup Guide

This guide helps you run API Sentinel locally or with Docker.

## Local Development

1) Install dependencies
```bash
npm install
```

2) Start PostgreSQL (Docker)
```bash
docker compose up -d postgres
```

3) Configure environment
```bash
cp config/env.example .env
# Edit .env (at least DATABASE_URL and JWT_SECRET)
```

4) Run migrations and start dev server
```bash
npm run db:push
npm run dev
```

## Production with Docker

1) Copy `.env` (do not commit it)
2) Build and run
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## GitHub App

Create a GitHub App, grant read access to repo contents and metadata, and subscribe to `push` and `pull_request` events. Set the webhook URL to `https://<your-domain>/api/integrations/github`. Add `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, and `GITHUB_WEBHOOK_SECRET` to `.env`.

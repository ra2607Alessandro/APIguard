# Contributing to API Guard (OSS Core)

Thanks for your interest! This repository houses the open‑source core. Please:

- Avoid committing secrets. Use `.env` locally; only commit `config/env.example`.
- Run checks locally: `npm run check` and `npm run build`.
- Keep features behind env flags when they require third‑party credentials.
- Match the TypeScript/formatting conventions already in the codebase.
- Current focus: see the three “Help wanted” issues linked in the `README.md`.

## Dev setup
- `npm install`
- `docker compose up -d postgres`
- Copy `config/env.example` to `.env` and adjust `DATABASE_URL`.
- `npm run db:push`
- `npm run dev`

## Pull requests
- Keep edits focused and small.
- Include tests/docs when adding functionality.
- Do not include sample secrets or tokens in examples.

## Reporting security issues
See `SECURITY.md`.




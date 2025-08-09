# API Guard 🛡️

Proactive API change monitoring for GitHub repositories.

API Sentinel monitors your GitHub repositories for API specification changes, detects breaking changes before they hit production, and alerts your team through email or Slack. It includes repository discovery, OpenAPI analysis, rule‑based breaking‑change detection, a CI/CD validation endpoint, and a React UI for visibility.

![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node](https://img.shields.io/badge/Node.js-20.x-green)

## Features
- Automatic API discovery in GitHub repositories
- OpenAPI parsing and comparison
- Rule‑based breaking‑change analysis with severity
- Baselines and change history
- Real‑time monitoring via GitHub App webhooks
- Optional alerts via Email (env‑gated)
- CI/CD validation endpoint to block risky deployments
- React UI for projects and change viewing

## Prerequisites
- Node.js 20+
- PostgreSQL 16+
- GitHub App or OAuth app (for repository access)
- Optional: SendGrid (email alerts), OpenAI (enhanced detection)

## Quick Start
1) Install dependencies
```bash
npm install
```
2) Start Postgres (Docker)
```bash
docker compose up -d postgres
```
3) Configure environment
- Copy `config/env.example` to `.env` and set at least `DATABASE_URL` and `JWT_SECRET`.
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/apisentinel
JWT_SECRET=your-secret-key
```
4) Run migrations and start dev server
```bash
npm run db:push
npm run dev
```

## CI/CD Integration
Use the CI validation endpoint to approve/block deployments based on breaking‑change analysis.

```bash
curl -X POST "$API_SENTINEL_URL/api/ci/validate" \
  -H "Authorization: Bearer $API_SENTINEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "newSchema": { /* OpenAPI JSON object */ },
    "environment": "production"
  }'
```

See `examples/github-actions/api-sentinel-check.yml` for a GitHub Actions example.

## Docker
Production Dockerfile is in `docker/Dockerfile`.

```bash
docker build -t api-sentinel -f docker/Dockerfile .
docker run -p 5000:5000 --env-file .env api-sentinel
```

For compose‑based deployment:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## GitHub App Setup (Monitoring)
1. Create a GitHub App with permissions:
   - Repository contents: Read‑only
   - Metadata: Read‑only
   - Webhooks: Subscribe to Push and Pull Request events
2. Set webhook URL to `https://<your-domain>/api/integrations/github`
3. Add credentials to `.env`:
```env
GITHUB_APP_ID=your-app-id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

## Configuration
Copy `config/env.example` to `.env` and fill as needed. All integrations are disabled unless their env vars are set.

## Documentation
- Setup guide: `docs/setup/README.md`
- API reference: `docs/api/README.md`
- Architecture overview: `docs/architecture/README.md`

## Contributing
Please read `CONTRIBUTING.md`. Good first issues include: adding detection rules, GitLab support, AsyncAPI support, and docs/tests.

## License
Apache‑2.0. See `LICENSE`.


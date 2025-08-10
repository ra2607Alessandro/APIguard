# API Guard 🛡️

Proactive API change monitoring for GitHub repositories.

API Guard monitors your GitHub repositories for API specification changes, detects breaking changes before they hit production, and alerts your team through email. It includes repository discovery, OpenAPI analysis, rule‑based breaking‑change detection, a CI/CD validation endpoint, and a React UI for visibility.

![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Node](https://img.shields.io/badge/Node.js-20.x-green)

## Features
- Automatic API discovery in GitHub repositories
- OpenAPI parsing and comparison
- Rule‑based breaking‑change analysis with severity
- Baselines and change history
- Real‑time monitoring via GitHub App webhooks
- Email alerts (configurable via environment variables)
- CI/CD validation endpoint to block risky deployments
- React UI for projects and change viewing

## Prerequisites
- Node.js 20+
- PostgreSQL 16+
- GitHub App or OAuth app (for repository access)
- Optional: SendGrid (email alerts), OpenAI (enhanced detection)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL (Docker)
```bash
docker compose up -d postgres
```

### 3. Configure Environment

⚠️ **Security Notice**: Never commit real credentials to version control.

Copy the example configuration and customize it:

```bash
cp config/env.example .env
```

**Required Variables** (minimum for basic functionality):
```env
# Database Connection (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/apisentinel

# JWT Secret for authentication (Required - Generate with: openssl rand -hex 32)
JWT_SECRET=your-generated-jwt-secret-here

# Server Configuration
PORT=5000
NODE_ENV=development
```

**Optional Integrations** (leave empty to disable):
```env
# GitHub App Integration
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# Email Alerts via SendGrid
SENDGRID_API_KEY=
FROM_EMAIL=

# Enhanced Detection via OpenAI
OPENAI_API_KEY=
```

### 4. Generate Secure Secrets

Generate strong secrets for production use:

```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate GITHUB_WEBHOOK_SECRET
openssl rand -hex 24
```

### 5. Run Migrations and Start Development Server
```bash
npm run db:push
npm run dev
```

The application will be available at `http://localhost:5000`.

## Configuration

### Environment Variables

All configuration is handled through environment variables. See `config/env.example` for a complete template.

#### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Secret key for JWT tokens | `generated-with-openssl-rand-hex-32` |

#### Optional Integrations

| Variable | Description | Required For |
|----------|-------------|--------------|
| `GITHUB_APP_ID` | GitHub App ID | Repository monitoring |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (PEM format) | Repository monitoring |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook secret | Webhook validation |
| `SENDGRID_API_KEY` | SendGrid API key | Email notifications |
| `FROM_EMAIL` | Email sender address | Email notifications |
| `OPENAI_API_KEY` | OpenAI API key | Enhanced change detection |

#### Security Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Security Best Practices

- **Never commit `.env` files** to version control
- **Use strong, randomly generated secrets** for `JWT_SECRET`
- **Store all sensitive credentials** in environment variables
- **Use different secrets** for development, staging, and production
- **Regularly rotate** API keys and secrets
- **Enable SSL/TLS** for database connections in production
- **Configure firewall rules** to restrict database access

## CI/CD Integration

Use the CI validation endpoint to approve/block deployments based on breaking‑change analysis.

### Endpoint

```http
POST /api/ci/validate
Content-Type: application/json
Authorization: Bearer <your-api-token>
```

### Request Body

```json
{
  "projectId": "your-project-id",
  "newSchema": {
    "openapi": "3.0.0",
    "info": { "title": "API", "version": "1.0.0" },
    "paths": {}
  },
  "environment": "production"
}
```

### Response

```json
{
  "approved": false,
  "breakingChanges": [
    {
      "type": "endpoint_removed",
      "severity": "high",
      "message": "DELETE /api/users/{id} endpoint was removed",
      "path": "/api/users/{id}"
    }
  ],
  "summary": {
    "total": 1,
    "high": 1,
    "medium": 0,
    "low": 0
  }
}
```

### GitHub Actions Integration

Create `.github/workflows/api-validation.yml`:

```yaml
name: API Validation
on:
  pull_request:
    paths:
      - 'openapi.json'
      - 'api/**'

jobs:
  validate-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate API Changes
        run: |
          response=$(curl -s -w "%{http_code}" -X POST \
            "${{ secrets.API_GUARD_URL }}/api/ci/validate" \
            -H "Authorization: Bearer ${{ secrets.API_GUARD_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d @openapi.json)
          
          http_code="${response: -3}"
          body="${response%???}"
          
          if [ "$http_code" != "200" ]; then
            echo "API validation failed"
            echo "$body"
            exit 1
          fi
          
          echo "API validation passed"
```

## GitHub App Setup (Repository Monitoring)

To enable automatic repository monitoring:

### 1. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Fill in the basic information:
   - **App name**: Your App Name
   - **Homepage URL**: `https://your-domain.com`
   - **Webhook URL**: `https://your-domain.com/api/integrations/github`

### 2. Set Permissions

Configure these **Repository permissions**:
- **Contents**: Read-only (to access repository files)
- **Metadata**: Read-only (to access basic repository info)

Subscribe to these **Events**:
- Push (to detect API changes)
- Pull request (to validate changes before merge)

### 3. Configure Environment

Add your GitHub App credentials to `.env`:

```env
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

**Security Notes**:
- Keep your private key secure and never commit it to version control
- Use a strong, randomly generated webhook secret
- Store the private key in a secure environment variable in production

### 4. Install the App

Install your GitHub App on the repositories you want to monitor.

## Docker Deployment

### Development
```bash
docker compose up -d
```

### Production

Build and run the production container:

```bash
# Build the image
docker build -t api-guard -f docker/Dockerfile .

# Run with environment file
docker run -d \
  --name api-guard \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  api-guard
```

### Docker Compose (Production)

Use the production compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will start:
- API Guard application
- PostgreSQL database
- Nginx reverse proxy (with SSL)

## Development

### Project Structure

```
api-guard/
├── src/
│   ├── controllers/     # API route handlers
│   ├── services/        # Business logic
│   ├── models/          # Database models
│   ├── middleware/      # Express middleware
│   └── utils/           # Utility functions
├── client/              # React frontend
├── config/              # Configuration files
├── docs/                # Documentation
├── docker/              # Docker configurations
└── migrations/          # Database migrations
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run tests
npm run lint         # Lint code
npm run db:push      # Push database schema
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
```

### Environment Setup

1. Copy environment template: `cp config/env.example .env`
2. Start PostgreSQL: `docker compose up -d postgres`
3. Run migrations: `npm run db:push`
4. Start development server: `npm run dev`

## API Reference

### Authentication

All API endpoints require authentication via JWT tokens:

```http
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

- `GET /api/projects` - List monitored projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Add new project
- `GET /api/projects/:id/changes` - Get change history
- `POST /api/ci/validate` - Validate API changes

See `docs/api/README.md` for complete API documentation.

## Documentation

- **Setup Guide**: `docs/setup/README.md`
- **API Reference**: `docs/api/README.md`
- **Architecture Overview**: `docs/architecture/README.md`
- **Security Policy**: `SECURITY.md`
- **Contributing Guide**: `CONTRIBUTING.md`

## Contributing

We welcome contributions! Please read `CONTRIBUTING.md` for guidelines.

### Good First Issues

- Adding new detection rules for breaking changes
- Improving test coverage
- Adding GitLab support
- Supporting AsyncAPI specifications
- Enhancing documentation

### Development Priorities

We're preparing for production and looking for help with:

1. **Local Development Reliability** - Ensuring "npm run dev" works out-of-the-box across all platforms
2. **GitHub App Integration** - Streamlining the OAuth flow for repository access
3. **Email Alerts** - Simplifying notification system to focus on email-only alerts

## Security

This project takes security seriously. Please see our [Security Policy](SECURITY.md) for reporting vulnerabilities.

**Never commit sensitive information** such as:
- API keys or tokens
- Database credentials
- Private keys
- Environment files (`.env`)

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Support

- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Ask questions in GitHub Discussions
- **Documentation**: Check the `docs/` directory
- **Security**: Email security issues to security@yourdomain.com

---

Built with ❤️ for the API development community.

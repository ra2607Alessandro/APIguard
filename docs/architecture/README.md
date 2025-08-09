# Architecture Overview

- Backend: Node.js/TypeScript (Express), Drizzle ORM, PostgreSQL
- Frontend: React (Vite), React Query, Tailwind
- GitHub Integration: GitHub App for repo access and webhooks
- Analyzer: OpenAPI parsing + rule-based breaking-change detection
- Alerts: Email (SendGrid) and Slack (optional, env-gated)

## Data Model (high-level)
- `projects` → `spec_sources` → `schema_versions` → `change_analyses`
- `environments`, `alert_configs`, `users`

## Flow
1. Discover specs in a repo or register spec sources
2. Monitor repo via webhook or scheduled checks
3. On changes, compare schemas and analyze rules
4. Store results and send alerts if configured
5. Expose CI endpoint to block risky deployments

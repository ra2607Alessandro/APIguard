# API Reference

## CI/CD Validation Endpoint

POST `/api/ci/validate`

Body:
```json
{
  "projectId": "<string>",
  "newSchema": { /* OpenAPI JSON object */ },
  "environment": "<string>"
}
```

Response:
```json
{
  "status": "approved|blocked",
  "analysis": { /* breaking and non-breaking changes */ },
  "message": "string"
}
```

Notes:
- `newSchema` must be a JSON object (convert YAML to JSON in your pipeline).
- When no previous version exists, the endpoint returns `approved`.

## Discovery
- POST `/api/discovery/repository` { repository }
- GET `/api/discovery/report/:owner/:repo`

## Projects and Specs
- See server routes in `server/routes.ts` for full list.

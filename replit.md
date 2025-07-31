# API Sentinel - Proactive API Change Monitoring

## Overview

API Sentinel is a comprehensive web application that monitors GitHub repositories for API changes and detects breaking changes before they hit production. The system automatically analyzes OpenAPI specifications, provides intelligent alerts for potentially breaking changes, and integrates seamlessly with CI/CD workflows to prevent risky deployments.

The application serves as a hands-off monitoring system that continuously tracks API changes, classifies them as breaking or non-breaking, and provides visual dashboards for change tracking and risk assessment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build system
- **UI Framework**: Radix UI components with Tailwind CSS for styling using the "new-york" style variant
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Component Library**: Comprehensive shadcn/ui component system with dark mode support
- **File Structure**: Monorepo structure with shared TypeScript types between client and server

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful API with structured error handling and logging middleware
- **Services**: Modular service architecture including GitHubMonitor, BreakingChangeAnalyzer, AlertService, and OpenAPIAnalyzer

### Database Design
- **Database**: PostgreSQL with comprehensive schema for project management
- **Tables**: Projects, spec sources, environments, schema versions, change analyses, alert configurations, discovered specs, monitoring configurations, and users
- **Relationships**: Well-defined foreign key relationships between projects and their associated resources
- **Migrations**: Drizzle-kit for database schema migrations

### Core Services
- **GitHub Monitor**: Automated repository scanning and change detection using GitHub API
- **Breaking Change Analyzer**: Rule-based system for classifying API changes by severity
- **Alert Service**: Multi-channel notification system supporting Slack, email, and webhooks
- **OpenAPI Analyzer**: Schema comparison and validation using Swagger Parser

### Authentication & Authorization
- Session-based authentication with PostgreSQL session storage
- User management system with project-based access control

## External Dependencies

### Third-Party APIs
- **GitHub API**: Repository monitoring and commit tracking via @octokit/rest
- **Slack Web API**: Team notifications and alerts via @slack/web-api

### Database & Infrastructure
- **Neon Database**: PostgreSQL hosting with serverless connection pooling
- **WebSocket Support**: Real-time communication capabilities

### Development & Build Tools
- **Vite**: Frontend build system with React plugin and runtime error overlay
- **ESBuild**: Server-side bundling for production builds
- **TypeScript**: Type safety across the entire application stack
- **Tailwind CSS**: Utility-first CSS framework with custom design system

### Monitoring & Analysis
- **OpenAPI Tools**: @apidevtools/swagger-parser for spec validation and analysis
- **Drizzle Kit**: Database schema management and migrations
- **Node Cron**: Scheduled monitoring tasks

### UI Components & Styling
- **Radix UI**: Accessible component primitives for complex UI patterns
- **Lucide React**: Consistent icon system
- **Date-fns**: Date manipulation and formatting utilities
- **Class Variance Authority**: Type-safe component variant management

The application is designed as a production-ready system with comprehensive error handling, type safety, and scalable architecture patterns suitable for enterprise API monitoring workflows.
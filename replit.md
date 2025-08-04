# API Sentinel - Proactive API Change Monitoring

## Overview

API Sentinel is a comprehensive web application that monitors GitHub repositories for API changes and detects breaking changes before they hit production. The system uses AI-powered intelligent detection to automatically discover OpenAPI specifications, provides intelligent alerts for potentially breaking changes, and integrates seamlessly with CI/CD workflows to prevent risky deployments.

The application serves as a hands-off monitoring system that continuously tracks API changes using LLM-based content analysis, classifies them as breaking or non-breaking, and provides visual dashboards for change tracking and risk assessment.

## Recent Changes (August 2025)

### Email-First Alert System Migration (Complete)
- **MIGRATION COMPLETE**: Successfully transitioned from Slack OAuth to email-based notifications
- **DATABASE SCHEMA**: Replaced alert_destinations table with user_notifications for email subscriptions
- **SENDGRID INTEGRATION**: Full EmailService implementation with breaking change alert templates
- **FRONTEND COMPONENTS**: Complete email notification management interface with project selection
- **BACKEND ROUTES**: Full CRUD operations for email subscription management with test functionality

### Comprehensive Email Alert Pipeline
- Project-specific email subscription management with active/inactive state tracking
- Rich HTML email templates for breaking change notifications with severity indicators
- Automated alert delivery integrated with existing GitHubMonitor and BreakingChangeAnalyzer
- SendGrid-powered email delivery with test functionality for subscription validation
- Clean navigation integration with dedicated Email Alerts section

### Streamlined Alert Architecture
- EmailService handles SendGrid API integration and template formatting
- AlertService focused on email-only notification distribution
- GitHubMonitor integrated with triggerEmailAlerts for automated breaking change detection
- Simplified single-channel alert system eliminating OAuth complexity

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
- **LLM Spec Detector**: AI-powered intelligent API specification detection using OpenAI GPT-4o-mini
- **Repository Scanner**: Two-stage detection system (file filtering + LLM content analysis)
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
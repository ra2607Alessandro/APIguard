import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertProjectSchema, 
  insertSpecSourceSchema, 
  insertAlertConfigSchema,
  insertDiscoveredSpecSchema,
  insertChangeAnalysisSchema,
  insertSlackWorkspaceSchema,
  insertUserSchema 
} from "@shared/schema";
import { GitHubMonitor } from "./services/github-monitor";
import { BreakingChangeAnalyzer } from "./services/breaking-change-rules";
import { AlertService } from "./services/alert-service";
import { OpenAPIAnalyzer } from "./services/openapi-analyzer";
import { githubService } from "./services/github";
import { insertGithubInstallationSchema } from "@shared/schema";
import { signup, login, authMiddleware } from "./services/auth";
import { 
  getGitHubAuthURL, 
  exchangeCodeForToken, 
  getGitHubUser,
  getUserRepositories,
  saveUserGitHubToken,
  createProjectFromRepo
} from "./services/github-oauth";

const githubMonitor = new GitHubMonitor(storage);
const breakingChangeAnalyzer = new BreakingChangeAnalyzer();
const alertService = new AlertService();
const openapiAnalyzer = new OpenAPIAnalyzer();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const token = await signup({ email: data.username, password: data.password });
      res.json({ token });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const token = await login({ email: data.username, password: data.password });
      res.json({ token });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  // GitHub OAuth routes
  app.get("/api/auth/github", authMiddleware, async (req: any, res) => {
    try {
      const authURL = getGitHubAuthURL(req.user.id);
      res.json({ authURL });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/github/callback", authMiddleware, async (req: any, res) => {
    try {
      const { code } = req.body;
      const accessToken = await exchangeCodeForToken(code);
      const githubUser = await getGitHubUser(accessToken);
      
      // Save encrypted token
      await saveUserGitHubToken(req.user.id, accessToken);
      
      res.json({ 
        success: true, 
        githubUser: { login: githubUser.login, name: githubUser.name } 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/auth/github/repositories", authMiddleware, async (req: any, res) => {
    try {
      const { getUserGitHubToken } = await import("./services/github-oauth");
      const accessToken = await getUserGitHubToken(req.user.id);
      if (!accessToken) {
        return res.status(400).json({ error: "GitHub not connected" });
      }
      const repos = await getUserRepositories(accessToken);
      res.json(repos);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/projects/from-repo", authMiddleware, async (req: any, res) => {
    try {
      const { repoData } = req.body;
      const project = await createProjectFromRepo(req.user.id, repoData);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Project routes with statistics
  app.get("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const projects = await storage.getProjects(req.user.id);
      
      // Fetch statistics for each project
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          try {
            const stats = await storage.getProjectStats(project.id);
            return {
              ...project,
              stats
            };
          } catch (error) {
            console.error(`Error fetching stats for project ${project.id}:`, error);
            return {
              ...project,
              stats: {
                apiCount: 0,
                breakingChanges: 0,
                safeChanges: 0,
                lastCheck: null,
                errorSources: []
              }
            };
          }
        })
      );
      
      res.json(projectsWithStats);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", authMiddleware, async (req: any, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      // Add user_id to project data
      const projectWithUser = { ...projectData, user_id: req.user.id };
      const project = await storage.createProject(projectWithUser);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.get("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id, req.user.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      // Verify user owns the project first
      const existingProject = await storage.getProject(req.params.id, req.user.id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, async (req: any, res) => {
    try {
      // Verify user owns the project first
      const existingProject = await storage.getProject(req.params.id, req.user.id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      
      // Add specific error messages for foreign key constraint failures
      if (error.code === '23503') {
        res.status(500).json({ message: "Cannot delete project: it has related data that must be removed first" });
      } else {
        res.status(500).json({ message: "Failed to delete project" });
      }
    }
  });

  // GitHub repository scanning with enhanced logging
  app.post("/api/discovery/repository", async (req, res) => {
    try {
      const { repository } = req.body;
      if (!repository) {
        return res.status(400).json({ message: "Repository is required" });
      }

      console.log(`🔍 Starting repository scan for: ${repository}`);
      const discoveredSpecs = await githubMonitor.scanRepository(repository);
      
      console.log(`📋 Scan results for ${repository}:`, {
        specsFound: discoveredSpecs.length,
        specs: discoveredSpecs.map(s => ({ 
          path: s.filePath, 
          name: s.apiName,
          version: s.version 
        }))
      });

      res.json({ 
        specs: discoveredSpecs,
        specsFound: discoveredSpecs.length,
        repository,
        message: discoveredSpecs.length > 0 
          ? `Found ${discoveredSpecs.length} OpenAPI specifications`
          : "No OpenAPI specifications found in common locations"
      });
    } catch (error: any) {
      console.error("❌ Error scanning repository:", error);
      res.status(500).json({ 
        message: "Failed to scan repository", 
        error: error.message,
        specs: [],
        specsFound: 0,
        repository: req.body.repository
      });
    }
  });

  app.get("/api/discovery/report/:owner/:repo", async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const report = await githubMonitor.getDiscoveryReport(owner, repo);
      res.json(report);
    } catch (error) {
      console.error("Error getting discovery report:", error);
      res.status(500).json({ message: "Failed to get discovery report" });
    }
  });

  // Spec sources
  app.get("/api/projects/:id/specs", async (req, res) => {
    try {
      const specs = await storage.getSpecSources(req.params.id);
      res.json(specs);
    } catch (error) {
      console.error("Error fetching spec sources:", error);
      res.status(500).json({ message: "Failed to fetch spec sources" });
    }
  });

  app.post("/api/projects/:id/specs", async (req, res) => {
    try {
      const specData = insertSpecSourceSchema.parse({
        ...req.body,
        project_id: req.params.id
      });
      const spec = await storage.createSpecSource(specData);
      res.status(201).json(spec);
    } catch (error) {
      console.error("Error creating spec source:", error);
      res.status(400).json({ message: "Invalid spec source data" });
    }
  });

  // Enhanced project creation with automatic spec source creation and monitoring setup
  app.post("/api/projects/setup", authMiddleware, async (req: any, res) => {
    try {
      const { name, github_repo, discovered_specs = [], alert_configs = [] } = req.body;
      
      console.log(`🏗️ Setting up project: ${name} with ${discovered_specs.length} specs`);
      
      // Create the project
      const project = await storage.createProject({
        name,
        github_repo,
        monitoring_frequency: 'daily',
        is_active: true,
        user_id: req.user.id // Add user_id for proper user scoping
      });

      console.log(`✅ Project created: ${project.id} - ${project.name}`);

      // Create spec sources for each discovered spec
      const createdSpecSources = [];
      for (const spec of discovered_specs) {
        const specSource = await storage.createSpecSource({
          project_id: project.id,
          type: 'github',
          source_path: spec.filePath,
          name: spec.apiName || `API from ${spec.filePath}`,
          is_active: true
        });
        createdSpecSources.push(specSource);
        console.log(`📄 Created spec source: ${specSource.name} at ${specSource.source_path}`);

        // Create initial schema version from discovered content
        if (spec.content) {
          const versionHash = githubMonitor.generateHash(JSON.stringify(spec.content));
          await storage.createSchemaVersion({
            project_id: project.id,
            version_hash: versionHash,
            content: spec.content,
            commit_sha: null,
            spec_source_id: specSource.id
          });
          console.log(`📋 Created initial schema version for ${specSource.name}`);
        }
      }

      // Create alert configurations
      const createdAlertConfigs = [];
      for (const alertConfig of alert_configs) {
        const config = await storage.createAlertConfig({
          project_id: project.id,
          channel_type: alertConfig.channel_type,
          config_data: alertConfig.config_data,
          is_active: true
        });
        createdAlertConfigs.push(config);
        console.log(`🚨 Created alert config: ${config.channel_type}`);
      }

      // Setup monitoring for the new project
      if (createdSpecSources.length > 0) {
        for (const specSource of createdSpecSources) {
          await githubMonitor.setupSourceMonitoring(project.id, specSource);
        }
        console.log(`🔍 Monitoring setup complete for ${createdSpecSources.length} spec sources`);
      }

      res.status(201).json({
        project,
        specSources: createdSpecSources,
        alertConfigs: createdAlertConfigs,
        message: `Project '${project.name}' created successfully with ${createdSpecSources.length} API specs and ${createdAlertConfigs.length} alert configurations`,
        monitoringActive: createdSpecSources.length > 0
      });

    } catch (error: any) {
      console.error("❌ Error setting up project:", error);
      res.status(400).json({ 
        message: "Failed to setup project", 
        error: error.message,
        details: error.stack
      });
    }
  });

  // Debug endpoint to check project monitoring status
  app.get("/api/debug/monitoring", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const debugInfo = [];

      for (const project of projects) {
        const specSources = await storage.getSpecSources(project.id);
        const schemaVersions = await storage.getSchemaVersions(project.id);
        const alertConfigs = await storage.getAlertConfigs(project.id);
        
        debugInfo.push({
          project: {
            id: project.id,
            name: project.name,
            github_repo: project.github_repo,
            is_active: project.is_active,
            monitoring_frequency: project.monitoring_frequency
          },
          specSources: specSources.map(s => ({
            id: s.id,
            source_path: s.source_path,
            name: s.name,
            is_active: s.is_active,
            type: s.type
          })),
          schemaVersionsCount: schemaVersions.length,
          alertConfigsCount: alertConfigs.length,
          monitoringActive: specSources.filter(s => s.is_active).length > 0,
          lastUpdate: project.updated_at
        });
      }

      res.json({
        timestamp: new Date().toISOString(),
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.is_active).length,
        projectDetails: debugInfo,
        systemStatus: {
          githubTokenConfigured: !!process.env.GITHUB_TOKEN,
          webhookSecretConfigured: !!process.env.GITHUB_WEBHOOK_SECRET,
          databaseConnected: true // Assuming if we got here, DB is working
        }
      });
    } catch (error: any) {
      console.error("❌ Debug endpoint error:", error);
      res.status(500).json({ 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const projectsCount = (await storage.getProjects()).length;
      
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          github: process.env.GITHUB_TOKEN ? "configured" : "missing_token",
          monitoring: projectsCount > 0 ? "active" : "inactive"
        },
        stats: {
          projects: projectsCount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Schema comparison
  app.post("/api/schemas/compare", async (req, res) => {
    try {
      const { oldSchema, newSchema } = req.body;
      if (!oldSchema || !newSchema) {
        return res.status(400).json({ message: "Both oldSchema and newSchema are required" });
      }

      const comparison = await openapiAnalyzer.compareSchemas(oldSchema, newSchema);
      const analysis = breakingChangeAnalyzer.analyzeChanges(comparison);
      
      res.json(analysis);
    } catch (error) {
      console.error("Error comparing schemas:", error);
      res.status(500).json({ message: "Failed to compare schemas" });
    }
  });

  // Change history
  app.get("/api/projects/:id/history", async (req, res) => {
    try {
      const analyses = await storage.getChangeAnalyses(req.params.id);
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching change history:", error);
      res.status(500).json({ message: "Failed to fetch change history" });
    }
  });

  // GitHub webhooks
  app.post("/api/integrations/github", async (req, res) => {
    try {
      // Verify webhook signature if secret is configured
      const signature = req.headers['x-hub-signature-256'];
      if (signature && process.env.GITHUB_WEBHOOK_SECRET) {
        const crypto = require('crypto');
        const expectedSignature = 'sha256=' + crypto
          .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');
        
        if (signature !== expectedSignature) {
          console.log('Invalid webhook signature');
          return res.status(401).json({ message: 'Invalid signature' });
        }
      }

      console.log('Webhook received:', {
        action: req.body.action || 'push',
        repository: req.body.repository?.full_name,
        commits: req.body.commits?.length || 0,
        head_commit: req.body.head_commit?.id || 'none'
      });

      await githubMonitor.handleWebhookEvent(req.body);
      res.status(200).json({ message: "Webhook processed" });
    } catch (error) {
      console.error("Error processing GitHub webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Alert configuration
  app.get("/api/projects/:id/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlertConfigs(req.params.id);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alert configs:", error);
      res.status(500).json({ message: "Failed to fetch alert configs" });
    }
  });

  app.post("/api/projects/:id/alerts", async (req, res) => {
    try {
      const alertData = insertAlertConfigSchema.parse({
        ...req.body,
        project_id: req.params.id
      });
      const alert = await storage.createAlertConfig(alertData);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert config:", error);
      res.status(400).json({ message: "Invalid alert config data" });
    }
  });

  app.post("/api/alerts/test", async (req, res) => {
    try {
      const { email, projectName } = req.body;
      if (!email || !projectName) {
        return res.status(400).json({ message: "Email and project name are required" });
      }
      
      const result = await alertService.testEmailAlert(email, projectName);
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      console.error("Error testing email alert:", error);
      res.status(500).json({ message: "Failed to test email alert" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authMiddleware, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user.id);
      const recentChanges = await storage.getRecentChangeAnalyses(5, req.user.id);
      res.json({ stats, recentChanges });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Manual monitoring trigger
  app.post("/api/projects/:id/monitoring/trigger", async (req, res) => {
    try {
      await githubMonitor.triggerManualCheck(req.params.id);
      res.json({ message: "Manual check triggered" });
    } catch (error) {
      console.error("Error triggering manual check:", error);
      res.status(500).json({ message: "Failed to trigger manual check" });
    }
  });

  // CI/CD integration
  app.post("/api/ci/validate", async (req, res) => {
    try {
      const { projectId, newSchema, environment } = req.body;
      
      if (!projectId || !newSchema) {
        return res.status(400).json({ message: "Project ID and new schema are required" });
      }

      const latestVersion = await storage.getLatestSchemaVersion(projectId);
      if (!latestVersion) {
        return res.json({ 
          status: "approved", 
          message: "No previous version found, allowing deployment" 
        });
      }

      const comparison = await openapiAnalyzer.compareSchemas(latestVersion.content, newSchema);
      const analysis = breakingChangeAnalyzer.analyzeChanges(comparison);

      const hasBreakingChanges = analysis.breakingChanges.length > 0;
      
      res.json({
        status: hasBreakingChanges ? "blocked" : "approved",
        analysis,
        message: hasBreakingChanges 
          ? "Deployment blocked due to breaking changes" 
          : "Deployment approved"
      });
    } catch (error) {
      console.error("Error validating CI/CD:", error);
      res.status(500).json({ message: "Failed to validate deployment" });
    }
  });

  // GitHub App Installation routes
  app.post("/api/github/installation", async (req, res) => {
    try {
      const { action, installation, repositories } = req.body;
      
      if (action === 'created') {
        // Handle new installation - will be connected to user through OAuth flow
        console.log(`New GitHub App installation: ${installation.id} for ${installation.account.login}`);
        res.status(200).json({ message: "Installation webhook received" });
      } else if (action === 'deleted') {
        // Handle installation removal
        await githubService.removeInstallation('', installation.id);
        res.status(200).json({ message: "Installation removed" });
      } else {
        res.status(200).json({ message: "Webhook received" });
      }
    } catch (error) {
      console.error("Error processing installation webhook:", error);
      res.status(500).json({ message: "Failed to process installation webhook" });
    }
  });

  app.get("/api/github/installations", async (req, res) => {
    try {
      // TODO: Get user ID from session when auth is implemented
      const userId = req.query.userId as string || 'default-user';
      const installations = await githubService.getUserInstallations(userId);
      res.json(installations);
    } catch (error) {
      console.error("Error fetching user installations:", error);
      res.status(500).json({ message: "Failed to fetch installations" });
    }
  });

  app.delete("/api/github/installation/:id", async (req, res) => {
    try {
      // TODO: Get user ID from session when auth is implemented
      const userId = req.query.userId as string || 'default-user';
      const installationId = parseInt(req.params.id);
      await githubService.removeInstallation(userId, installationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing installation:", error);
      res.status(500).json({ message: "Failed to remove installation" });
    }
  });

  app.get("/api/github/installation/:id/repositories", async (req, res) => {
    try {
      const installationId = parseInt(req.params.id);
      const repositories = await githubService.getInstallationRepositories(installationId);
      res.json(repositories);
    } catch (error) {
      console.error("Error fetching installation repositories:", error);
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  // GitHub App OAuth connection
  app.post("/api/github/connect", async (req, res) => {
    try {
      const { userId, installationId, accountLogin, accountType, permissions } = req.body;
      
      const installation = await githubService.storeInstallation({
        userId,
        installationId,
        accountLogin,
        accountType,
        permissions,
      });
      
      res.status(201).json(installation);
    } catch (error) {
      console.error("Error connecting GitHub installation:", error);
      res.status(500).json({ message: "Failed to connect GitHub installation" });
    }
  });

  // Repository scanning with installation token
  app.post("/api/discovery/repository-with-installation", async (req, res) => {
    try {
      const { repository, installationId } = req.body;
      
      if (!repository || !installationId) {
        return res.status(400).json({ message: "Repository and installation ID are required" });
      }

      // Parse repository string
      let owner: string, repo: string;
      if (repository.includes('/')) {
        [owner, repo] = repository.split('/');
      } else {
        return res.status(400).json({ message: "Repository must be in format 'owner/repo'" });
      }

      // Check if installation can access this repository
      const canAccess = await githubService.canAccessRepository(parseInt(installationId), owner, repo);
      if (!canAccess) {
        return res.status(403).json({ message: "Installation does not have access to this repository" });
      }

      // Scan repository using installation token
      const result = await githubService.scanRepositoryForSpecs(parseInt(installationId), owner, repo);
      
      res.json(result);
    } catch (error) {
      console.error("Error scanning repository with installation:", error);
      res.status(500).json({ message: "Failed to scan repository" });
    }
  });

  // POST /api/discovery/compare-methods - Compare LLM vs Pattern-based detection
  app.post('/api/discovery/compare-methods', async (req, res) => {
    try {
      const { repository } = req.body;
      
      if (!repository) {
        return res.status(400).json({ error: 'Repository is required' });
      }
      
      console.log(`📊 Comparing detection methods for ${repository}...`);
      
      // Parse repository
      let owner: string, repo: string;
      
      if (repository.includes('github.com')) {
        const match = repository.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid GitHub repository URL' });
        }
        [, owner, repo] = match;
        repo = repo.replace(/\.git$/, '');
      } else if (repository.includes('/')) {
        [owner, repo] = repository.split('/');
      } else {
        return res.status(400).json({ error: 'Invalid repository format' });
      }
      
      // Use the repositoryScanner's comparison method
      const { default: RepositoryScanner } = await import('./services/repositoryScanner.js');
      const repositoryScanner = new RepositoryScanner(process.env.GITHUB_TOKEN!);
      const comparisonReport = await repositoryScanner.compareDetectionMethods(owner, repo);
      
      res.json({
        repository: `${owner}/${repo}`,
        timestamp: new Date().toISOString(),
        comparison: comparisonReport,
        summary: {
          llmFound: comparisonReport.llmDetectionResults.length,
          patternFound: comparisonReport.patternMatchingResults.length,
          improvement: {
            additionalSpecs: comparisonReport.improvementMetrics.additionalSpecsFound,
            processingTime: comparisonReport.improvementMetrics.processingTimeComparison
          }
        }
      });
    } catch (error: any) {
      console.error('Error comparing detection methods:', error);
      res.status(500).json({ error: error.message || 'Failed to compare detection methods' });
    }
  });

  // Slack OAuth routes (MILESTONE 1)

  app.get("/api/slack/oauth/start", async (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const clientId = process.env.SLACK_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ message: "Slack client ID not configured" });
      }

      const scopes = 'channels:read,groups:read,chat:write,team:read,users:read';
      const state = Buffer.from(JSON.stringify({ projectId })).toString('base64');
      const redirectUri = `${req.protocol}://${req.get('host')}/api/slack/oauth/callback`;
      
      const slackOAuthUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${clientId}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      res.redirect(slackOAuthUrl);
    } catch (error) {
      console.error("Error starting Slack OAuth:", error);
      res.status(500).json({ message: "Failed to start OAuth flow" });
    }
  });

  app.get("/api/slack/oauth/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("Slack OAuth error:", error);
        return res.redirect(`/settings/integrations/slack?error=${error}`);
      }

      if (!code || !state) {
        return res.status(400).json({ message: "Missing OAuth code or state" });
      }

      // Decode state to get projectId
      const { projectId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

      // Exchange code for token
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID!,
          client_secret: process.env.SLACK_CLIENT_SECRET!,
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/slack/oauth/callback`
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.ok) {
        console.error("Slack token exchange failed:", tokenData);
        return res.redirect(`/settings/integrations/slack?error=token_exchange_failed`);
      }

      // Create slack workspace record
      const workspace = await storage.createSlackWorkspace({
        project_id: projectId,
        team_id: tokenData.team.id,
        team_name: tokenData.team.name,
        access_token: tokenData.access_token,
        bot_user_id: tokenData.bot_user_id
      });

      res.redirect(`/settings/integrations/slack?connected=1&workspace=${workspace.id}`);
    } catch (error) {
      console.error("Error in Slack OAuth callback:", error);
      res.redirect(`/settings/integrations/slack?error=callback_failed`);
    }
  });

  // Slack workspace management (MILESTONE 1)
  app.get("/api/projects/:projectId/slack/workspaces", async (req, res) => {
    try {
      const workspaces = await storage.getSlackWorkspaces(req.params.projectId);
      // Return workspaces without sensitive access tokens
      const safeWorkspaces = workspaces.map(({ access_token, ...workspace }) => workspace);
      res.json(safeWorkspaces);
    } catch (error) {
      console.error("Error fetching Slack workspaces:", error);
      res.status(500).json({ message: "Failed to fetch Slack workspaces" });
    }
  });

  // Slack channel discovery (MILESTONE 2)
  app.get("/api/slack/workspaces/:workspaceId/channels", async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const token = await storage.getSlackToken(workspaceId);

      // Fetch channels using Slack Web API
      const channelsResponse = await fetch('https://slack.com/api/conversations.list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const channelsData = await channelsResponse.json();

      if (!channelsData.ok) {
        console.error("Slack API error:", channelsData.error);
        return res.status(400).json({ message: `Slack API error: ${channelsData.error}` });
      }

      // Filter for channels the bot can post to
      const availableChannels = channelsData.channels
        .filter((channel: any) => !channel.is_archived && (channel.is_member || channel.is_public))
        .map((channel: any) => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          isMember: channel.is_member
        }));

      res.json(availableChannels);
    } catch (error) {
      console.error("Error fetching Slack channels:", error);
      res.status(500).json({ message: "Failed to fetch Slack channels" });
    }
  });

  // Test Slack notification
  app.post("/api/slack/test", async (req, res) => {
    try {
      const { workspaceId, channelId } = req.body;
      
      if (!workspaceId || !channelId) {
        return res.status(400).json({ message: "Workspace ID and channel ID are required" });
      }

      const token = await storage.getSlackToken(workspaceId);

      const testMessage = {
        channel: channelId,
        text: "🚀 API Sentinel Test Notification",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚀 API Sentinel Test Notification"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "This is a test message from API Sentinel. Your Slack integration is working correctly! 🎉"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn", 
              text: `*Timestamp:* ${new Date().toISOString()}\n*Status:* ✅ Integration Active`
            }
          }
        ]
      };

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });

      const result = await response.json();

      if (!result.ok) {
        console.error("Slack API error:", result.error);
        return res.status(400).json({ message: `Slack API error: ${result.error}` });
      }

      res.json({ success: true, message: "Test notification sent successfully" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Email notification routes
  app.get("/api/projects/:projectId/notifications", async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.params.projectId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/projects/:projectId/notifications", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const notification = {
        project_id: req.params.projectId,
        email: email,
        is_active: true
      };

      const created = await storage.createUserNotification(notification);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(400).json({ message: "Failed to create notification" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await storage.deleteUserNotification(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Test email notification
  app.post("/api/projects/:projectId/notifications/test", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { emailService } = await import('./services/email-service.js');
      await emailService.sendTestEmail(email, project.name);

      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Start GitHub monitoring
  await githubMonitor.startMonitoring();

  const httpServer = createServer(app);
  return httpServer;
}

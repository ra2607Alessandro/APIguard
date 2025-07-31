import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertProjectSchema, 
  insertSpecSourceSchema, 
  insertAlertConfigSchema,
  insertDiscoveredSpecSchema,
  insertChangeAnalysisSchema 
} from "@shared/schema";
import { GitHubMonitor } from "./services/github-monitor";
import { BreakingChangeAnalyzer } from "./services/breaking-change-rules";
import { AlertService } from "./services/alert-service";
import { OpenAPIAnalyzer } from "./services/openapi-analyzer";

const githubMonitor = new GitHubMonitor(storage);
const breakingChangeAnalyzer = new BreakingChangeAnalyzer();
const alertService = new AlertService();
const openapiAnalyzer = new OpenAPIAnalyzer();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const projectData = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, projectData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // GitHub repository scanning
  app.post("/api/discovery/repository", async (req, res) => {
    try {
      const { repository } = req.body;
      if (!repository) {
        return res.status(400).json({ message: "Repository is required" });
      }

      const discoveredSpecs = await githubMonitor.scanRepository(repository);
      res.json({ specs: discoveredSpecs });
    } catch (error) {
      console.error("Error scanning repository:", error);
      res.status(500).json({ message: "Failed to scan repository" });
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
      const { channelType, configData } = req.body;
      const result = await alertService.testAlert(channelType, configData);
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      console.error("Error testing alert:", error);
      res.status(500).json({ message: "Failed to test alert" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const recentChanges = await storage.getRecentChangeAnalyses(5);
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

  // Start GitHub monitoring
  await githubMonitor.startMonitoring();

  const httpServer = createServer(app);
  return httpServer;
}

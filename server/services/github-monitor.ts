import { Octokit } from "@octokit/rest";
import * as cron from "node-cron";
import type { IStorage } from "../storage";
import type { SpecSource, MonitoringConfig } from "@shared/schema";

interface DiscoveredSpec {
  filePath: string;
  apiName: string;
  version?: string;
  content: any;
}

export class GitHubMonitor {
  private octokit: Octokit;
  private activeMonitors: Map<string, any> = new Map();
  private cronJobs: Map<string, any> = new Map();

  constructor(private storage: IStorage) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async startMonitoring(): Promise<void> {
    console.log("Starting GitHub monitoring...");
    try {
      const projects = await this.storage.getProjects();
      
      for (const project of projects) {
        if (project.is_active && project.github_repo) {
          const sources = await this.storage.getSpecSources(project.id);
          for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
            await this.setupSourceMonitoring(project.id, source);
          }
        }
      }
      console.log(`Started monitoring for ${projects.length} projects`);
    } catch (error) {
      console.error("Error starting GitHub monitoring:", error);
    }
  }

  async setupSourceMonitoring(projectId: string, source: SpecSource): Promise<void> {
    const project = await this.storage.getProject(projectId);
    if (!project || !project.github_repo) return;

    const [owner, repo] = project.github_repo.split('/');
    const monitorKey = `${projectId}-${source.id}`;

    // Setup webhook if not exists
    try {
      await this.ensureWebhook(owner, repo);
    } catch (error) {
      console.error(`Failed to setup webhook for ${owner}/${repo}:`, error);
    }

    // Setup cron job based on frequency
    const frequency = project.monitoring_frequency || 'daily';
    const cronExpression = this.getCronExpression(frequency);
    
    if (this.cronJobs.has(monitorKey)) {
      this.cronJobs.get(monitorKey).destroy();
    }

    const job = cron.schedule(cronExpression, async () => {
      await this.checkForChanges(projectId, source, owner, repo);
    });

    this.cronJobs.set(monitorKey, job);
    console.log(`Setup monitoring for ${owner}/${repo} - ${source.source_path}`);
  }

  private getCronExpression(frequency: string): string {
    switch (frequency) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 0 * * *';
      case 'weekly': return '0 0 * * 0';
      default: return '0 0 * * *';
    }
  }

  async ensureWebhook(owner: string, repo: string): Promise<void> {
    try {
      const webhooks = await this.octokit.repos.listWebhooks({
        owner,
        repo,
      });

      const existingWebhook = webhooks.data.find(
        hook => hook.config?.url?.includes('/api/integrations/github')
      );

      if (!existingWebhook) {
        await this.octokit.repos.createWebhook({
          owner,
          repo,
          name: 'web',
          config: {
            url: `${process.env.API_URL || 'http://localhost:5000'}/api/integrations/github`,
            content_type: 'json',
            secret: process.env.GITHUB_WEBHOOK_SECRET || 'default-secret',
          },
          events: ['push', 'pull_request'],
          active: true,
        });
        console.log(`Created webhook for ${owner}/${repo}`);
      }
    } catch (error) {
      console.error(`Error managing webhook for ${owner}/${repo}:`, error);
    }
  }

  async handleWebhookEvent(payload: any): Promise<void> {
    try {
      console.log('Processing webhook event:', payload.action || 'push');
      
      const repository = payload.repository;
      if (!repository) {
        console.log('No repository in webhook payload');
        return;
      }

      const owner = repository.owner.login;
      const repo = repository.name;
      
      // Handle push events
      if (payload.head_commit || payload.commits) {
        const commitSha = payload.head_commit?.id;
        console.log(`Processing push event for ${owner}/${repo}, commit: ${commitSha}`);
        
        // Find projects monitoring this repository
        const projects = await this.storage.getProjects();
        const relevantProjects = projects.filter(p => 
          p.github_repo === `${owner}/${repo}` && p.is_active
        );

        console.log(`Found ${relevantProjects.length} projects monitoring ${owner}/${repo}`);

        for (const project of relevantProjects) {
          const sources = await this.storage.getSpecSources(project.id);
          for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
            console.log(`Checking for changes in ${source.source_path}`);
            await this.checkForChanges(project.id, source, owner, repo, commitSha);
          }
        }
        return;
      }

      // Handle PR events
      if (payload.pull_request && ['opened', 'synchronize', 'reopened'].includes(payload.action)) {
        const commitSha = payload.pull_request.head.sha;
        console.log(`Processing PR event for ${owner}/${repo}, commit: ${commitSha}`);
        
        // Process PR events (same logic as push events)
        const projects = await this.storage.getProjects();
        const relevantProjects = projects.filter(p => 
          p.github_repo === `${owner}/${repo}` && p.is_active
        );

        for (const project of relevantProjects) {
          const sources = await this.storage.getSpecSources(project.id);
          for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
            await this.checkForChanges(project.id, source, owner, repo, commitSha);
          }
        }
      }

      console.log('Webhook processing completed successfully');
    } catch (error) {
      console.error("Error handling webhook event:", error);
      throw error;
    }
  }

  async checkForChanges(
    projectId: string, 
    source: SpecSource, 
    owner: string, 
    repo: string, 
    commitSha?: string
  ): Promise<void> {
    try {
      // Get current spec content
      const fileResponse = await this.octokit.repos.getContent({
        owner,
        repo,
        path: source.source_path,
        ref: commitSha || 'main',
      });

      if (Array.isArray(fileResponse.data) || fileResponse.data.type !== 'file') {
        console.log(`Skipping ${source.source_path} - not a file`);
        return;
      }

      const content = Buffer.from(fileResponse.data.content, 'base64').toString();
      let parsedContent;

      try {
        parsedContent = source.source_path.endsWith('.json') 
          ? JSON.parse(content) 
          : require('js-yaml').load(content);
      } catch (parseError) {
        console.error(`Error parsing ${source.source_path}:`, parseError);
        return;
      }

      // Get latest version for comparison
      const latestVersion = await this.storage.getLatestSchemaVersion(source.id);
      const versionHash = this.generateHash(JSON.stringify(parsedContent));

      // Check if content has changed
      if (latestVersion && latestVersion.version_hash === versionHash) {
        console.log(`No changes detected in ${source.source_path}`);
        return;
      }

      // Create new schema version
      const newVersion = await this.storage.createSchemaVersion({
        project_id: projectId,
        version_hash: versionHash,
        content: parsedContent,
        commit_sha: commitSha || null,
        spec_source_id: source.id,
      });

      console.log(`New version created for ${source.source_path}: ${newVersion.id}`);

      // If we have a previous version, analyze changes
      if (latestVersion) {
        console.log(`Analyzing changes between versions for ${source.source_path}`);
        
        try {
          // Import the required services
          const { OpenAPIAnalyzer } = await import('./openapi-analyzer');
          const { BreakingChangeAnalyzer } = await import('./breaking-change-rules');
          const { AlertService } = await import('./alert-service');
          
          const openapiAnalyzer = new OpenAPIAnalyzer();
          const breakingChangeAnalyzer = new BreakingChangeAnalyzer();
          const alertService = new AlertService();

          // Compare schemas
          const comparison = await openapiAnalyzer.compareSchemas(
            latestVersion.content, 
            parsedContent
          );
          
          // Analyze for breaking changes
          const analysis = breakingChangeAnalyzer.analyzeChanges(comparison);
          
          console.log(`Analysis complete: ${analysis.breakingChanges.length} breaking, ${analysis.nonBreakingChanges.length} safe changes`);
          
          // Store the analysis
          await this.storage.createChangeAnalysis({
            project_id: projectId,
            old_version_id: latestVersion.id,
            new_version_id: newVersion.id,
            breaking_changes: analysis.breakingChanges,
            non_breaking_changes: analysis.nonBreakingChanges,
            analysis_summary: analysis.summary,
            severity: this.calculateSeverity(analysis.breakingChanges)
          });

          // Trigger alerts if there are breaking changes
          if (analysis.breakingChanges.length > 0) {
            const project = await this.storage.getProject(projectId);
            const alertConfigs = await this.storage.getAlertConfigs(projectId);
            
            if (project && alertConfigs.length > 0) {
              await alertService.triggerConfiguredAlerts(
                projectId,
                project.name,
                analysis,
                alertConfigs
              );
              console.log(`🚨 Alerts sent for ${analysis.breakingChanges.length} breaking changes in ${project.name}`);
            } else {
              console.log(`⚠️  Breaking changes found but no alert configs for project ${projectId}`);
            }
          } else {
            console.log(`✅ No breaking changes detected in ${source.source_path}`);
          }
          
        } catch (error) {
          console.error(`Error analyzing changes for ${source.source_path}:`, error);
        }
      }

    } catch (error) {
      console.error(`Error checking for changes in ${source.source_path}:`, error);
    }
  }

  async scanRepository(repository: string): Promise<DiscoveredSpec[]> {
    const [owner, repo] = repository.split('/');
    const discoveredSpecs: DiscoveredSpec[] = [];

    console.log(`🔍 Scanning repository ${owner}/${repo} for OpenAPI specs...`);

    try {
      // Common paths where OpenAPI specs are found
      const commonPaths = [
        'openapi.yaml',
        'openapi.yml', 
        'openapi.json',
        'swagger.yaml',
        'swagger.yml',
        'swagger.json',
        'api/openapi.yaml',
        'api/openapi.yml',
        'api/openapi.json',
        'docs/openapi.yaml',
        'docs/openapi.yml', 
        'docs/openapi.json',
        'spec/openapi.yaml',
        'spec/openapi.yml',
        'spec/openapi.json',
        'specs/openapi.yaml',
        'specs/openapi.yml',
        'specs/openapi.json',
        'api-spec.yaml',
        'api-spec.yml',
        'api.yaml',
        'api.yml',
        'api.json'
      ];

      console.log(`📋 Checking ${commonPaths.length} common OpenAPI file paths...`);

      for (const path of commonPaths) {
        try {
          console.log(`🔍 Checking path: ${path}`);
          const fileResponse = await this.octokit.repos.getContent({
            owner,
            repo,
            path,
          });

          if (!Array.isArray(fileResponse.data) && fileResponse.data.type === 'file') {
            const content = Buffer.from(fileResponse.data.content, 'base64').toString();
            let parsedContent;

            try {
              parsedContent = path.endsWith('.json') 
                ? JSON.parse(content) 
                : require('js-yaml').load(content);

              // Validate it's actually an OpenAPI spec
              if (this.isValidOpenAPISpec(parsedContent)) {
                console.log(`✅ Found valid OpenAPI spec at: ${path}`);
                discoveredSpecs.push({
                  filePath: path,
                  apiName: this.extractApiName(parsedContent, path),
                  version: this.extractVersion(parsedContent),
                  content: parsedContent
                });
              } else {
                console.log(`❌ File at ${path} is not a valid OpenAPI spec`);
              }
            } catch (parseError: any) {
              console.log(`❌ Failed to parse ${path}: ${parseError.message}`);
            }
          }
        } catch (error) {
          // File doesn't exist, continue to next path
          console.log(`❌ Path ${path} not found`);
        }
      }

      console.log(`✅ Repository scan complete. Found ${discoveredSpecs.length} OpenAPI specs`);
      return discoveredSpecs;

    } catch (error) {
      console.error(`❌ Error scanning repository ${repository}:`, error);
      throw error;
    }
  }

  async getDiscoveryReport(owner: string, repo: string): Promise<any> {
    try {
      const repository = `${owner}/${repo}`;
      const specs = await this.scanRepository(repository);
      
      return {
        repository,
        specsFound: specs.length,
        specs: specs.map(spec => ({
          filePath: spec.filePath,
          apiName: spec.apiName,
          version: spec.version,
        })),
        lastScanned: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error generating discovery report for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async triggerManualCheck(projectId: string): Promise<void> {
    try {
      const project = await this.storage.getProject(projectId);
      if (!project || !project.github_repo) {
        throw new Error("Project not found or no GitHub repository configured");
      }

      const [owner, repo] = project.github_repo.split('/');
      const sources = await this.storage.getSpecSources(projectId);

      for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
        await this.checkForChanges(projectId, source, owner, repo);
      }

      console.log(`Manual check completed for project ${projectId}`);
    } catch (error) {
      console.error(`Error during manual check for project ${projectId}:`, error);
      throw error;
    }
  }

  private async getFileContent(owner: string, repo: string, path: string): Promise<any> {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data) || response.data.type !== 'file') {
        return null;
      }

      const content = Buffer.from(response.data.content, 'base64').toString();
      
      try {
        return path.endsWith('.json') 
          ? JSON.parse(content) 
          : require('js-yaml').load(content);
      } catch (parseError) {
        console.error(`Error parsing ${path}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
      return null;
    }
  }

  private extractApiName(content: any, filePath: string): string {
    if (content?.info?.title) {
      return content.info.title;
    }
    
    // Fallback to file path
    const fileName = filePath.split('/').pop()?.replace(/\.(yml|yaml|json)$/, '') || 'Unknown API';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private extractVersion(content: any): string | undefined {
    return content?.info?.version;
  }



  private calculateSeverity(breakingChanges: any[]): string {
    if (breakingChanges.length === 0) return 'low';
    
    const hasCritical = breakingChanges.some(change => change.severity === 'critical');
    if (hasCritical) return 'critical';
    
    const hasHigh = breakingChanges.some(change => change.severity === 'high');
    if (hasHigh) return 'high';
    
    const hasMedium = breakingChanges.some(change => change.severity === 'medium');
    if (hasMedium) return 'medium';
    
    return 'low';
  }

  // Add this helper method to the GitHubMonitor class
  private isValidOpenAPISpec(content: any): boolean {
    try {
      // Check for OpenAPI 3.x
      if (content.openapi && content.info && content.paths) {
        return true;
      }
      // Check for Swagger 2.x  
      if (content.swagger && content.info && content.paths) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Make generateHash public for use in routes
  public generateHash(content: string): string {
    // Simple hash function - in production, use a proper hash library
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

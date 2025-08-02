import { Octokit } from "@octokit/rest";
import * as cron from "node-cron";
import type { IStorage } from "../storage";
import type { SpecSource, MonitoringConfig } from "@shared/schema";
import * as yaml from 'js-yaml';
import RepositoryScanner from './repositoryScanner.js';

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
  private repositoryScanner: RepositoryScanner;

  constructor(private storage: IStorage) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }

    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Initialize LLM-based repository scanner
    this.repositoryScanner = new RepositoryScanner(process.env.GITHUB_TOKEN);
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

    const { owner, repo } = this.parseRepositoryUrl(project.github_repo);
    if (!owner || !repo) {
      console.error(`Invalid repository format: ${project.github_repo}`);
      return;
    }
    
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

  private parseRepositoryUrl(repoUrl: string): { owner: string; repo: string } {
    // Handle different formats:
    // "owner/repo"
    // "https://github.com/owner/repo"
    // "https://github.com/owner/repo.git"
    
    if (!repoUrl) return { owner: '', repo: '' };
    
    // Clean the URL
    let cleanUrl = repoUrl.trim();
    
    // Remove .git suffix if present
    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.slice(0, -4);
    }
    
    // Extract owner/repo from different formats
    if (cleanUrl.includes('github.com')) {
      // Full GitHub URL format
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    } else if (cleanUrl.includes('/') && !cleanUrl.includes('://')) {
      // Simple owner/repo format
      const [owner, repo] = cleanUrl.split('/');
      if (owner && repo) {
        return { owner, repo };
      }
    }
    
    console.warn(`Could not parse repository URL: ${repoUrl}`);
    return { owner: '', repo: '' };
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
            url: `https://${process.env.REPLIT_DEV_DOMAIN || process.env.API_URL || 'localhost:5000'}/api/integrations/github`,
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
        const relevantProjects = projects.filter(p => {
          if (!p.github_repo || !p.is_active) return false;
          const parsed = this.parseRepositoryUrl(p.github_repo);
          return parsed.owner === owner && parsed.repo === repo;
        });

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
        const relevantProjects = projects.filter(p => {
          if (!p.github_repo || !p.is_active) return false;
          const parsed = this.parseRepositoryUrl(p.github_repo);
          return parsed.owner === owner && parsed.repo === repo;
        });

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
    // Handle both full GitHub URLs and owner/repo format
    let owner: string, repo: string;
    
    if (repository.includes('github.com')) {
      // Extract from full URL like https://github.com/owner/repo
      const match = repository.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        throw new Error(`Invalid GitHub repository URL: ${repository}`);
      }
      [, owner, repo] = match;
      // Remove .git suffix if present
      repo = repo.replace(/\.git$/, '');
    } else if (repository.includes('/')) {
      // Handle owner/repo format
      [owner, repo] = repository.split('/');
    } else {
      throw new Error(`Invalid repository format: ${repository}. Expected 'owner/repo' or GitHub URL`);
    }
    
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected 'owner/repo' or GitHub URL`);
    }
    
    console.log(`📍 Parsed repository: ${owner}/${repo} from input: ${repository}`);
    
    try {
      // Use LLM-based intelligent detection as the primary method
      console.log(`🤖 Starting intelligent API spec detection for ${owner}/${repo}`);
      const specInfos = await this.repositoryScanner.detectSpecsWithFallback(owner, repo);
      
      // Convert to DiscoveredSpec format
      const discoveredSpecs: DiscoveredSpec[] = specInfos.map(spec => ({
        filePath: spec.filePath,
        apiName: spec.apiName,
        version: spec.version,
        content: spec.content
      }));

      console.log(`✅ Intelligent detection found ${discoveredSpecs.length} API specs in ${owner}/${repo}`);
      
      return discoveredSpecs;
    } catch (error: any) {
      console.error(`❌ Intelligent detection failed for ${owner}/${repo}:`, error.message);
      return [];
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

  // Recursive search for OpenAPI specs in any directory
  private async recursiveSearch(
    owner: string, 
    repo: string, 
    branch: string, 
    path: string, 
    discoveredSpecs: DiscoveredSpec[], 
    depth: number
  ): Promise<void> {
    // Limit recursion depth to prevent infinite loops
    if (depth > 3) {
      console.log(`🔍 Max recursion depth reached for path: ${path}`);
      return;
    }

    try {
      const contents = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });

      if (Array.isArray(contents.data)) {
        for (const item of contents.data) {
          if (item.type === 'file') {
            // Check if this file might be an OpenAPI spec
            if (this.isLikelyOpenAPIFile(item.name)) {
              console.log(`🔍 Found potential OpenAPI file: ${item.path}`);
              try {
                const fileResponse = await this.octokit.repos.getContent({
                  owner,
                  repo,
                  path: item.path,
                  ref: branch
                });

                if (!Array.isArray(fileResponse.data) && fileResponse.data.type === 'file') {
                  const content = Buffer.from(fileResponse.data.content, 'base64').toString();
                  let parsedContent;

                  try {
                    if (item.name.endsWith('.json')) {
                      parsedContent = JSON.parse(content);
                    } else {
                      try {
                        parsedContent = yaml.load(content);
                      } catch (yamlError: any) {
                        // Fallback: Try to parse as JSON in case it's a JSON file with .yaml extension
                        console.log(`YAML parsing failed for ${item.path}, trying JSON fallback: ${yamlError.message}`);
                        parsedContent = JSON.parse(content);
                      }
                    }

                    if (this.isValidOpenAPISpec(parsedContent)) {
                      console.log(`✅ Found valid OpenAPI spec at: ${item.path}`);
                      discoveredSpecs.push({
                        filePath: item.path,
                        apiName: this.extractApiName(parsedContent, item.path),
                        version: this.extractVersion(parsedContent),
                        content: parsedContent
                      });
                    }
                  } catch (parseError: any) {
                    console.log(`❌ Failed to parse ${item.path}: ${parseError.message}`);
                  }
                }
              } catch (error: any) {
                console.log(`❌ Error reading file ${item.path}: ${error.message}`);
              }
            }
          } else if (item.type === 'dir' && !this.shouldSkipDirectory(item.name)) {
            // Recursively search subdirectories
            await this.recursiveSearch(owner, repo, branch, item.path, discoveredSpecs, depth + 1);
          }
        }
      }
    } catch (error: any) {
      console.log(`❌ Error scanning directory ${path}: ${error.message}`);
    }
  }

  // Check if a file name suggests it might be an OpenAPI spec
  private isLikelyOpenAPIFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    const openApiKeywords = ['openapi', 'swagger', 'api'];
    const extensions = ['.yaml', '.yml', '.json'];
    
    return extensions.some(ext => lowerName.endsWith(ext)) &&
           openApiKeywords.some(keyword => lowerName.includes(keyword));
  }

  // Skip common directories that are unlikely to contain OpenAPI specs
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', '.github', 'vendor', 'target', 'build', 'dist', 'out'];
    return skipDirs.includes(dirName.toLowerCase());
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

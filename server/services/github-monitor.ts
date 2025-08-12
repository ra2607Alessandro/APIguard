import { Octokit } from "@octokit/rest";
import * as cron from "node-cron";
import type { IStorage } from "../storage";
import type { SpecSource, MonitoringConfig } from "@shared/schema";
import * as yaml from 'js-yaml';
import * as crypto from 'crypto';
import RepositoryScanner from './repositoryScanner.js';

import { AlertService } from './alert-service'; 

interface DiscoveredSpec {
  filePath: string;
  apiName: string;
  version?: string;
  content: any;
}

export class GitHubMonitor {
  private activeMonitors: Map<string, any> = new Map();
  private cronJobs: Map<string, any> = new Map();
  private repositoryScanner: RepositoryScanner | null = null;

  constructor(private storage: IStorage) {
    // No longer using global GITHUB_TOKEN - will use installation tokens
  }

  private async getOctokitForRepo(userId: string, owner: string, repo: string): Promise<Octokit> {
    const { githubAppService } = await import("./github-app");
    const installationId = await githubAppService.getUserInstallationIdForRepo(userId, owner, repo);
    if (!installationId) {
      throw new Error(`Could not find installation for ${owner}/${repo} for user ${userId}`);
    }
    const octokit = await githubAppService.getInstallationOctokit(installationId);
    this.repositoryScanner = new RepositoryScanner(octokit);
    return octokit;
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
    if (!project || !project.github_repo || !project.user_id) return;

    const { owner, repo } = this.parseRepositoryUrl(project.github_repo);
    if (!owner || !repo) {
      console.error(`Invalid repository format: ${project.github_repo}`);
      return;
    }
    
    const monitorKey = `${projectId}-${source.id}`;

    // Setup webhook if not exists
    try {
      await this.ensureWebhook(project.user_id, owner, repo);
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
      await this.checkForChanges(projectId, source, project.user_id!, owner, repo);
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
    if (!repoUrl) return { owner: '', repo: '' };
    let cleanUrl = repoUrl.trim();
    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.slice(0, -4);
    }
    if (cleanUrl.includes('github.com')) {
      const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    } else if (cleanUrl.includes('/') && !cleanUrl.includes('://')) {
      const [owner, repo] = cleanUrl.split('/');
      if (owner && repo) {
        return { owner, repo };
      }
    }
    console.warn(`Could not parse repository URL: ${repoUrl}`);
    return { owner: '', repo: '' };
  }

  async ensureWebhook(userId: string, owner: string, repo: string): Promise<void> {
    try {
      const octokit = await this.getOctokitForRepo(userId, owner, repo);
      const webhooks = await octokit.repos.listWebhooks({
        owner,
        repo,
      });

      const existingWebhook = webhooks.data.find(
        hook => hook.config?.url?.includes('/api/integrations/github')
      );

      if (!existingWebhook) {
        await octokit.repos.createWebhook({
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
          try {
            const sources = await this.storage.getSpecSources(project.id);
            for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
              console.log(`Checking for changes in ${source.source_path}`);
              try {
                await this.checkForChanges(project.id, source, project.user_id!, owner, repo, commitSha);
              } catch (sourceError: any) {
                console.error(`❌ Failed to check ${source.source_path} in project ${project.name}:`, sourceError.message);
                console.error(`   Continuing with other sources...`);
              }
            }
          } catch (projectError: any) {
            console.error(`❌ Failed to process project ${project.name}:`, projectError.message);
            console.error(`   Continuing with other projects...`);
          }
        }
        return;
      }

      // Handle PR events
      if (payload.pull_request && ['opened', 'synchronize', 'reopened'].includes(payload.action)) {
        const commitSha = payload.pull_request.head.sha;
        console.log(`Processing PR event for ${owner}/${repo}, commit: ${commitSha}`);
        
        const projects = await this.storage.getProjects();
        const relevantProjects = projects.filter(p => {
          if (!p.github_repo || !p.is_active) return false;
          const parsed = this.parseRepositoryUrl(p.github_repo);
          return parsed.owner === owner && parsed.repo === repo;
        });

        for (const project of relevantProjects) {
          try {
            const sources = await this.storage.getSpecSources(project.id);
            for (const source of sources.filter(s => s.type === 'github' && s.is_active)) {
              try {
                await this.checkForChanges(project.id, source, project.user_id!, owner, repo, commitSha);
              } catch (sourceError: any) {
                console.error(`❌ Failed to check ${source.source_path} in project ${project.name}:`, sourceError.message);
                console.error(`   Continuing with other sources...`);
              }
            }
          } catch (projectError: any) {
            console.error(`❌ Failed to process project ${project.name}:`, projectError.message);
            console.error(`   Continuing with other projects...`);
          }
        }
      }

      console.log('✅ Webhook processing completed successfully');
    } catch (error: any) {
      console.error("❌ Critical error handling webhook event:", error.message);
      console.error("   Stack trace:", error.stack);
      console.error("   Service health: Monitoring continues despite this error");
    }
  }

  async checkForChanges(
    projectId: string, 
    source: SpecSource, 
    userId: string,
    owner: string, 
    repo: string, 
    commitSha?: string
  ): Promise<void> {
    try {
      const octokit = await this.getOctokitForRepo(userId, owner, repo);
      const fileResponse = await octokit.repos.getContent({
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
        if (source.source_path.endsWith('.json')) {
          parsedContent = JSON.parse(content);
        } else {
          const validation = this.validateYamlStructure(content);
          if (!validation.isValid) {
            console.error(`❌ YAML parsing failed for ${source.source_path}:`);
            console.error(`   Error: ${validation.error}`);
            console.error(`   Treating as CRITICAL breaking change - triggering alerts`);
            await this.createParsingFailureAnalysis(projectId, source, validation.error || 'Unknown YAML error', commitSha);
            await this.storeParsingError(source.id, projectId, validation.error || 'Unknown YAML error');
            return;
          }
          parsedContent = yaml.load(validation.cleanedContent!);
          if (!parsedContent || typeof parsedContent !== 'object') {
            throw new Error('Parsed YAML is not a valid object');
          }
        }
      } catch (parseError: any) {
        console.error(`❌ File parsing failed for ${source.source_path}:`);
        console.error(`   Error: ${parseError.message}`);
        console.error(`   Treating as CRITICAL breaking change - triggering alerts`);
        await this.createParsingFailureAnalysis(projectId, source, parseError.message, commitSha);
        await this.storeParsingError(source.id, projectId, parseError.message);
        return;
      }

      const latestVersion = await this.storage.getLatestSchemaVersion(source.id);
      const versionHash = this.generateHash(JSON.stringify(parsedContent), projectId, source.id);

      console.log(`🔍 Pipeline state for ${source.source_path}:`);
      console.log(`  - Latest version exists: ${!!latestVersion}`);
      console.log(`  - Latest version hash: ${latestVersion?.version_hash || 'none'}`);
      console.log(`  - New content hash: ${versionHash}`);
      console.log(`  - Content changed: ${!latestVersion || latestVersion.version_hash !== versionHash}`);

      if (latestVersion && latestVersion.version_hash === versionHash) {
        console.log(`No changes detected in ${source.source_path}`);
        return;
      }

      const newVersion = await this.storage.createSchemaVersionWithTransaction({
        project_id: projectId,
        version_hash: versionHash,
        content: parsedContent,
        commit_sha: commitSha || null,
        spec_source_id: source.id,
      });

      console.log(`New version created for ${source.source_path}: ${newVersion.id}`);

      console.log(`📊 Analysis decision for ${source.source_path}:`);
      console.log(`  - Has previous version: ${!!latestVersion}`);
      console.log(`  - Previous version ID: ${latestVersion?.id || 'none'}`);
      console.log(`  - Will run analysis: YES (always run analysis)`);

      try {
        const { OpenAPIAnalyzer } = await import('./openapi-analyzer');
        const { BreakingChangeAnalyzer } = await import('./breaking-change-rules');
        const { AlertService } = await import('./alert-service');
        
        const openapiAnalyzer = new OpenAPIAnalyzer();
        const breakingChangeAnalyzer = new BreakingChangeAnalyzer();
        const alertService = new AlertService();

        let comparison;
        let analysisType: string;

        if (latestVersion && latestVersion.content) {
          console.log(`  - Comparing versions: ${latestVersion.id} → ${newVersion.id}`);
          comparison = await openapiAnalyzer.compareSchemas(
            latestVersion.content, 
            parsedContent
          );
          analysisType = 'version_comparison';
        } else {
          console.log(`  - First version analysis: treating as baseline`);
          comparison = await openapiAnalyzer.compareSchemas(
            {}, 
            parsedContent
          );
          analysisType = 'baseline_creation';
        }
        
        const analysis = breakingChangeAnalyzer.analyzeChanges(comparison);
        
        console.log(`📊 Analysis complete (${analysisType}): ${analysis.breakingChanges.length} breaking, ${analysis.nonBreakingChanges.length} safe changes`);
        
        await this.storage.createChangeAnalysis({
          project_id: projectId,
          old_version_id: latestVersion?.id || null,
          new_version_id: newVersion.id,
          breaking_changes: analysis.breakingChanges,
          non_breaking_changes: analysis.nonBreakingChanges,
          analysis_summary: analysis.summary,
          severity: this.calculateSeverity(analysis.breakingChanges)
        });

        const shouldAlert = latestVersion ? 
          analysis.breakingChanges.length > 0 : 
          analysis.breakingChanges.some(change => !change.description.includes('new endpoint'));

        if (shouldAlert && analysis.breakingChanges.length > 0) {
          const project = await this.storage.getProject(projectId);
          const alertConfigs = await this.storage.getAlertConfigs(projectId);
          if (project) {
            try {
              await alertService.triggerEmailAlerts(
                projectId,
                source.source_path,
                analysis
              );
              console.log(`🚨 Email alerts sent for ${analysis.breakingChanges.length} breaking changes in ${project.name}`);
            } catch (emailError: any) {
              console.error(`Failed to send email alerts: ${emailError.message}`);
            }
          }
        } else if (latestVersion) {
          console.log(`✅ No breaking changes detected in ${source.source_path}`);
        } else {
          console.log(`✅ Baseline created for ${source.source_path} with ${analysis.nonBreakingChanges.length} endpoints`);
        }

        await this.clearParsingError(source.id, projectId);
        
      } catch (error: any) {
        console.error(`❌ Critical analysis error for ${source.source_path}:`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Type: ${error.constructor.name}`);
        console.error(`   Stack trace:`, error.stack);
        console.error(`   Analysis failed but monitoring continues for other projects`);
        await this.storeParsingError(source.id, projectId, error.message);
        console.error(`🏥 Service Health Check:`);
        console.error(`   - Monitoring service: ACTIVE`);
        console.error(`   - Error handling: RESILIENT`);
        console.error(`   - Project isolation: ENABLED`);
      }

    } catch (error: any) {
      console.error(`❌ Failed to check changes in ${source.source_path}:`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Type: ${error.constructor.name}`);
      console.error(`   Monitoring continues for other sources and projects`);
      await this.storeParsingError(source.id, projectId, error.message);
    }
  }

  private async createParsingFailureAnalysis(
    projectId: string, 
    source: SpecSource, 
    errorMessage: string, 
    commitSha?: string
  ): Promise<void> {
    const project = await this.storage.getProject(projectId);
    if (!project) return;

    const breakingChanges = [{
      type: 'critical',
      path: source.source_path,
      description: `Failed to parse OpenAPI spec: ${errorMessage}`
    }];

    const analysis = {
      breakingChanges,
      nonBreakingChanges: [],
      summary: `Critical error in ${source.source_path}: Parsing failed.`
    };

    const alertService = new AlertService();
    await alertService.triggerEmailAlerts(projectId, source.source_path, analysis);

    const savedAnalysis = await this.storage.createChangeAnalysis({
      project_id: projectId,
      old_version_id: null,
      new_version_id: null,
      breaking_changes: analysis.breakingChanges,
      non_breaking_changes: analysis.nonBreakingChanges,
      analysis_summary: analysis.summary,
      severity: 'critical'
    });

    console.log(`🚨 Created critical parsing failure analysis: ${savedAnalysis.id}`);
  }

  private async storeParsingError(sourceId: string, projectId: string, errorMessage: string): Promise<void> {
    try {
      await this.storage.updateSpecSourceError(sourceId, errorMessage);
      await this.storage.updateProjectHealth(projectId, 'error');
      console.log(`💾 Stored parsing error for source ${sourceId}`);
    } catch (error: any) {
      console.error(`Failed to store parsing error:`, error.message);
    }
  }

  private async clearParsingError(sourceId: string, projectId: string): Promise<void> {
    try {
      await this.storage.clearSpecSourceError(sourceId);
      const sources = await this.storage.getSpecSources(projectId);
      // Fix: Check for null before calling .some()
      const hasErrors = Array.isArray(sources) && sources.some(s => s.last_error);
      if (!hasErrors) {
        await this.storage.updateProjectHealth(projectId, 'healthy');
      }
      console.log(`🧹 Cleared parsing error for source ${sourceId}`);
    } catch (error: any) {
      console.error(`Failed to clear parsing error:`, error.message);
    }
  }

  async scanRepository(repository: string): Promise<DiscoveredSpec[]> {
    let owner: string, repo: string;
    if (repository.includes('github.com')) {
      const match = repository.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        throw new Error(`Invalid GitHub repository URL: ${repository}`);
      }
      [, owner, repo] = match;
      repo = repo.replace(/\.git$/, '');
    } else if (repository.includes('/')) {
      [owner, repo] = repository.split('/');
    } else {
      throw new Error(`Invalid repository format: ${repository}. Expected 'owner/repo' or GitHub URL`);
    }
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected 'owner/repo' or GitHub URL`);
    }
    console.log(`📍 Parsed repository: ${owner}/${repo} from input: ${repository}`);
    try {
      console.log(`🤖 Starting intelligent API spec detection for ${owner}/${repo}`);
      const specInfos = await this.repositoryScanner.detectSpecsWithFallback(owner, repo);
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
        await this.checkForChanges(projectId, source, project.user_id, owner, repo);
      }
      console.log(`Manual check completed for project ${projectId}`);
    } catch (error) {
      console.error(`Error during manual check for project ${projectId}:`, error);
      throw error;
    }
  }

  private async getFileContent(octokit: Octokit, owner: string, repo: string, path: string): Promise<any> {
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if ('content' in response.data) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
      throw new Error("No content found in file response");
    } catch (error: any) {
      console.error(`Failed to get file content for ${owner}/${repo}/${path}:`, error.message);
      throw error;
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

  private isValidOpenAPISpec(content: any): boolean {
    try {
      if (content.openapi && content.info && content.paths) {
        return true;
      }
      if (content.swagger && content.info && content.paths) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async recursiveSearch(
    octokit: Octokit,
    owner: string, 
    repo: string, 
    branch: string, 
    path: string, 
    discoveredSpecs: DiscoveredSpec[], 
    depth: number
  ): Promise<void> {
    if (depth > 3) {
      console.log(`🔍 Max recursion depth reached for path: ${path}`);
      return;
    }
    try {
      const contents = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      if (Array.isArray(contents.data)) {
        for (const item of contents.data) {
          if (item.type === 'file') {
            if (this.isLikelyOpenAPIFile(item.name)) {
              console.log(`🔍 Found potential OpenAPI file: ${item.path}`);
              try {
                const fileResponse = await octokit.rest.repos.getContent({
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
            await this.recursiveSearch(octokit, owner, repo, branch, item.path, discoveredSpecs, depth + 1);
          }
        }
      }
    } catch (error: any) {
      console.log(`❌ Error scanning directory ${path}: ${error.message}`);
    }
  }

  private isLikelyOpenAPIFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    const openApiKeywords = ['openapi', 'swagger', 'api'];
    const extensions = ['.yaml', '.yml', '.json'];
    return extensions.some(ext => lowerName.endsWith(ext)) &&
           openApiKeywords.some(keyword => lowerName.includes(keyword));
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', '.github', 'vendor', 'target', 'build', 'dist', 'out'];
    return skipDirs.includes(dirName.toLowerCase());
  }

  private extractApiName(content: any, filePath: string): string {
    if (content?.info?.title) {
      return content.info.title;
    }
    const fileName = filePath.split('/').pop()?.replace(/\.(yml|yaml|json)$/, '') || 'Unknown API';
    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
  }

  private extractVersion(content: any): string | undefined {
    return content?.info?.version;
  }

  private validateYamlStructure(content: string): { isValid: boolean; cleanedContent?: string; error?: string } {
    try {
      const lines = content.split('\n');
      const cleanedLines = lines.map(line => {
        if (line.trim().length === 0) return '';
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
        if (leadingSpaces > 8) {
          const normalizedIndent = Math.floor(leadingSpaces / 4) * 2;
          return ' '.repeat(normalizedIndent) + line.trim();
        }
        return line;
      });
      const cleanedContent = cleanedLines.join('\n');
      yaml.load(cleanedContent);
      return { isValid: true, cleanedContent };
    } catch (error: any) {
      return {
        isValid: false,
        error: `YAML parsing failed: ${error.message}${error.mark ? ` at line ${error.mark.line + 1}, column ${error.mark.column + 1}` : ''}`
      };
    }
  }

  public generateHash(content: string, projectId?: string, sourceId?: string): string {
    const contextualContent = `${projectId || ''}:${sourceId || ''}:${content}`;
    return crypto.createHash('sha256').update(contextualContent).digest('hex');
  }
}

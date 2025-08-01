import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { db } from "../db";
import { github_installations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as crypto from "crypto";

export class GitHubService {
  private app: App;

  constructor() {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error("GITHUB_APP_ID environment variable must be set");
    }
    if (!process.env.GITHUB_PRIVATE_KEY) {
      throw new Error("GITHUB_PRIVATE_KEY environment variable must be set");
    }

    this.app = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
    });
  }

  /**
   * Get an Octokit instance for a specific installation
   */
  async getInstallationOctokit(installationId: number) {
    return await this.app.getInstallationOctokit(installationId);
  }

  /**
   * Get installation by user ID and installation ID
   */
  async getInstallation(userId: string, installationId: number) {
    const [installation] = await db
      .select()
      .from(github_installations)
      .where(
        and(
          eq(github_installations.user_id, userId),
          eq(github_installations.installation_id, installationId)
        )
      );
    return installation;
  }

  /**
   * Get all installations for a user
   */
  async getUserInstallations(userId: string) {
    return await db
      .select()
      .from(github_installations)
      .where(eq(github_installations.user_id, userId));
  }

  /**
   * Store installation data
   */
  async storeInstallation(data: {
    userId: string;
    installationId: number;
    accountLogin: string;
    accountType: 'User' | 'Organization';
    permissions: any;
  }) {
    const [installation] = await db
      .insert(github_installations)
      .values({
        user_id: data.userId,
        installation_id: data.installationId,
        account_login: data.accountLogin,
        account_type: data.accountType,
        permissions: data.permissions,
      })
      .returning();
    
    return installation;
  }

  /**
   * Remove installation
   */
  async removeInstallation(userId: string, installationId: number) {
    await db
      .delete(github_installations)
      .where(
        and(
          eq(github_installations.user_id, userId),
          eq(github_installations.installation_id, installationId)
        )
      );
  }

  /**
   * Update installation permissions
   */
  async updateInstallationPermissions(installationId: number, permissions: any) {
    await db
      .update(github_installations)
      .set({
        permissions,
        updated_at: new Date(),
      })
      .where(eq(github_installations.installation_id, installationId));
  }

  /**
   * Get repositories accessible by an installation
   */
  async getInstallationRepositories(installationId: number) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    try {
      const response = await octokit.rest.apps.listReposAccessibleToInstallation();
      return response.data.repositories;
    } catch (error) {
      console.error(`Failed to get repositories for installation ${installationId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a repository is accessible by an installation
   */
  async canAccessRepository(installationId: number, owner: string, repo: string): Promise<boolean> {
    try {
      const repositories = await this.getInstallationRepositories(installationId);
      return repositories.some((r: any) => r.owner.login === owner && r.name === repo);
    } catch (error) {
      console.error(`Failed to check repository access for ${owner}/${repo}:`, error);
      return false;
    }
  }

  /**
   * Get file content from repository using installation token
   */
  async getRepositoryFile(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to get file ${path} from ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Scan repository for OpenAPI specs using installation token
   */
  async scanRepositoryForSpecs(
    installationId: number,
    owner: string,
    repo: string
  ) {
    const octokit = await this.getInstallationOctokit(installationId);
    const discoveredSpecs: any[] = [];

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
      'api.json',
    ];

    // Get repository info to determine default branch
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    console.log(`🔍 Scanning repository ${owner}/${repo} for OpenAPI specs using installation ${installationId}...`);
    console.log(`📝 Using default branch: ${defaultBranch}`);

    for (const path of commonPaths) {
      try {
        console.log(`🔍 Checking path: ${path} in ${owner}/${repo}`);
        const fileResponse = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: defaultBranch,
        });

        if ('content' in fileResponse.data) {
          const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
          
          // Basic validation for OpenAPI/Swagger content
          if (content.includes('openapi:') || content.includes('swagger:') || 
              content.includes('"openapi"') || content.includes('"swagger"')) {
            
            // Extract API name and version
            let apiName = path;
            let version = 'unknown';
            
            try {
              if (path.endsWith('.json')) {
                const parsed = JSON.parse(content);
                apiName = parsed.info?.title || path;
                version = parsed.info?.version || parsed.openapi || parsed.swagger || 'unknown';
              } else {
                // Basic YAML parsing for title and version
                const titleMatch = content.match(/title:\s*['"]?([^'"\\n]+)['"]?/);
                const versionMatch = content.match(/version:\s*['"]?([^'"\\n]+)['"]?/);
                const openapiMatch = content.match(/openapi:\s*['"]?([^'"\\n]+)['"]?/);
                
                apiName = titleMatch ? titleMatch[1] : path;
                version = versionMatch ? versionMatch[1] : (openapiMatch ? openapiMatch[1] : 'unknown');
              }
            } catch (parseError: any) {
              console.log(`❌ Failed to parse ${path}: ${parseError.message}`);
            }

            discoveredSpecs.push({
              filePath: path,
              apiName,
              version,
              size: fileResponse.data.size,
              downloadUrl: fileResponse.data.download_url,
            });

            console.log(`✅ Found OpenAPI spec: ${path} (${apiName} v${version})`);
          }
        }
      } catch (error: any) {
        console.log(`❌ Path ${path} not found: ${error.status || error.message}`);
      }
    }

    console.log(`✅ Repository scan complete. Found ${discoveredSpecs.length} OpenAPI specs`);
    return {
      specsFound: discoveredSpecs.length,
      specs: discoveredSpecs,
      repository: `${owner}/${repo}`,
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }
}

export const githubService = new GitHubService();
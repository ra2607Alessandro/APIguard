import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { storage } from "../storage";

export class GitHubAppService {
  private app: Octokit;

  constructor() {
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY) {
      throw new Error("GitHub App credentials not configured");
    }

    this.app = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });
  }

  /**
   * Get installation access token for a specific installation
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const { data } = await this.app.rest.apps.createInstallationAccessToken({
      installation_id: installationId,
    });
    return data.token;
  }

  /**
   * Get all installations for the app
   */
  async getInstallations() {
    const { data } = await this.app.rest.apps.listInstallations();
    return data;
  }

  /**
   * Get installation for a specific user
   */
  async getUserInstallation(username: string) {
    try {
      const { data } = await this.app.rest.apps.getUserInstallation({
        username,
      });
      return data;
    } catch (error: any) {
      if (error.status === 404) {
        return null; // App not installed for user
      }
      throw error;
    }
  }

  /**
   * Get repositories accessible by an installation
   */
  async getInstallationRepositories(installationId: number) {
    const token = await this.getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });
    
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation();
    return data.repositories;
  }

  /**
   * Save user's GitHub App installation
   */
  async saveUserInstallation(userId: string, installationId: number, githubUsername: string) {
    return await storage.saveUserGitHubInstallation(userId, installationId, githubUsername);
  }

  /**
   * Get user's GitHub App installation
   */
  async getUserInstallationId(userId: string): Promise<number | null> {
    const installation = await storage.getUserGitHubInstallation(userId);
    return installation?.installation_id || null;
  }

  /**
   * Get installation details
   */
  async getInstallationDetails(installationId: number) {
    const appOctokit = new Octokit({ auth: await this.generateJWT() });
    const { data } = await appOctokit.rest.apps.getInstallation({
      installation_id: installationId,
    });
    return data;
  }

  /**
   * Generate GitHub App installation URL
   */
  getInstallationURL(): string {
    // Include setup URL for post-installation callback
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const protocol = baseUrl.includes('replit.app') ? 'https' : 'http';
    const setupUrl = encodeURIComponent(`${protocol}://${baseUrl}/api/auth/github/setup`);
    
    return `https://github.com/apps/the-api-sentinel/installations/new?setup_url=${setupUrl}`;
  }
}

export const githubAppService = new GitHubAppService();